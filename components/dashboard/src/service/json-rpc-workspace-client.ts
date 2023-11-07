/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { CallOptions, Code, ConnectError, PromiseClient } from "@connectrpc/connect";
import { PartialMessage } from "@bufbuild/protobuf";
import { WorkspaceService } from "@gitpod/public-api/lib/gitpod/v1/workspace_connect";
import {
    GetWorkspaceRequest,
    GetWorkspaceResponse,
    WatchWorkspaceStatusRequest,
    WatchWorkspaceStatusResponse,
    ListWorkspacesRequest,
    ListWorkspacesRequest_Scope,
    ListWorkspacesResponse,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { converter } from "./public-api";
import { getGitpodService } from "./service";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { generateAsyncGenerator } from "@gitpod/gitpod-protocol/lib/generate-async-generator";
import { WorkspaceInstance } from "@gitpod/gitpod-protocol";

export class JsonRpcWorkspaceClient implements PromiseClient<typeof WorkspaceService> {
    async getWorkspace(request: PartialMessage<GetWorkspaceRequest>): Promise<GetWorkspaceResponse> {
        if (!request.id) {
            throw new ConnectError("id is required", Code.InvalidArgument);
        }
        const info = await getGitpodService().server.getWorkspace(request.id);
        const workspace = converter.toWorkspace(info);
        const result = new GetWorkspaceResponse();
        result.item = workspace;
        return result;
    }

    async *watchWorkspaceStatus(
        request: PartialMessage<WatchWorkspaceStatusRequest>,
        options?: CallOptions,
    ): AsyncIterable<WatchWorkspaceStatusResponse> {
        if (!options?.signal) {
            throw new ConnectError("signal is required", Code.InvalidArgument);
        }
        if (request.workspaceId) {
            const resp = await this.getWorkspace({ id: request.workspaceId });
            if (resp.item?.status) {
                const response = new WatchWorkspaceStatusResponse();
                response.workspaceId = resp.item.id;
                response.status = resp.item.status;
                yield response;
            }
        }
        const it = generateAsyncGenerator<WorkspaceInstance>(
            (queue) => {
                try {
                    const dispose = getGitpodService().registerClient({
                        onInstanceUpdate: (instance) => {
                            queue.push(instance);
                        },
                    });
                    return () => {
                        dispose.dispose();
                    };
                } catch (e) {
                    queue.fail(e);
                }
            },
            { signal: options.signal },
        );
        for await (const item of it) {
            if (!item) {
                continue;
            }
            if (request.workspaceId && item.workspaceId !== request.workspaceId) {
                continue;
            }
            const status = converter.toWorkspace(item).status;
            if (!status) {
                continue;
            }
            const response = new WatchWorkspaceStatusResponse();
            response.workspaceId = item.workspaceId;
            response.status = status;
            yield response;
        }
    }

    async listWorkspaces(
        request: PartialMessage<ListWorkspacesRequest>,
        _options?: CallOptions,
    ): Promise<ListWorkspacesResponse> {
        request.scope = request.scope ?? ListWorkspacesRequest_Scope.MY_WORKSPACES_IN_ORGANIZATION;
        if (
            request.scope === ListWorkspacesRequest_Scope.MY_WORKSPACES_IN_ORGANIZATION ||
            request.scope === ListWorkspacesRequest_Scope.ALL_WORKSPACES_IN_ORGANIZATION
        ) {
            throw new ConnectError("organization_id is required", Code.InvalidArgument);
        }
        const server = getGitpodService().server;
        const pageSize = request.pagination?.pageSize || 100;
        const workspaces = await server.getWorkspaces({
            organizationId: request.organizationId,
            pinnedOnly: request.pinned === true ? true : undefined,
            limit: pageSize,
            offset: (request.pagination?.page ?? 0) * pageSize,
        });
        const response = new ListWorkspacesResponse();
        response.workspaces = workspaces.map((info) => converter.toWorkspace(info));
        response.pagination = new PaginationResponse();
        response.pagination.total = workspaces.length;
        return response;
    }
}
