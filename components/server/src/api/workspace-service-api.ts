/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { WorkspaceService as WorkspaceServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/workspace_connect";
import {
    GetWorkspaceRequest,
    GetWorkspaceResponse,
    WatchWorkspaceStatusRequest,
    WatchWorkspaceStatusResponse,
    ListWorkspacesRequest,
    ListWorkspacesRequest_Scope,
    ListWorkspacesResponse,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { inject, injectable } from "inversify";
import { WorkspaceService } from "../workspace/workspace-service";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";

@injectable()
export class WorkspaceServiceAPI implements ServiceImpl<typeof WorkspaceServiceInterface> {
    @inject(WorkspaceService)
    private readonly workspaceService: WorkspaceService;

    @inject(PublicAPIConverter)
    private readonly apiConverter: PublicAPIConverter;

    async getWorkspace(req: GetWorkspaceRequest, context: HandlerContext): Promise<GetWorkspaceResponse> {
        const info = await this.workspaceService.getWorkspace(context.user.id, req.id);
        const response = new GetWorkspaceResponse();
        response.item = this.apiConverter.toWorkspace(info);
        return response;
    }

    async *watchWorkspaceStatus(
        req: WatchWorkspaceStatusRequest,
        context: HandlerContext,
    ): AsyncIterable<WatchWorkspaceStatusResponse> {
        if (req.workspaceId) {
            const instance = await this.workspaceService.getCurrentInstance(context.user.id, req.workspaceId);
            const status = this.apiConverter.toWorkspace(instance).status;
            if (status) {
                const response = new WatchWorkspaceStatusResponse();
                response.workspaceId = instance.workspaceId;
                response.status = status;
                yield response;
            }
        }
        const it = this.workspaceService.watchWorkspaceStatus(context.user.id, { signal: context.signal });
        for await (const instance of it) {
            if (!instance) {
                continue;
            }
            if (req.workspaceId && instance.workspaceId !== req.workspaceId) {
                continue;
            }
            const status = this.apiConverter.toWorkspace(instance).status;
            if (!status) {
                continue;
            }
            const response = new WatchWorkspaceStatusResponse();
            response.workspaceId = instance.workspaceId;
            response.status = status;
            yield response;
        }
    }

    async listWorkspaces(req: ListWorkspacesRequest, context: HandlerContext): Promise<ListWorkspacesResponse> {
        // TODO: pagination check - max min pageSize ...
        // TODO: implement req.scope req.sorts
        // TODO: if scope is `SCOPE_ALL_WORKSPACES_IN_INSTALLATION` check admin permission
        req.scope = req.scope ?? ListWorkspacesRequest_Scope.MY_WORKSPACES_IN_ORGANIZATION;
        if (
            req.scope === ListWorkspacesRequest_Scope.MY_WORKSPACES_IN_ORGANIZATION ||
            req.scope === ListWorkspacesRequest_Scope.ALL_WORKSPACES_IN_ORGANIZATION
        ) {
            throw new ConnectError("organization_id is required", Code.InvalidArgument);
        }
        const pageSize = req.pagination?.pageSize ?? 100;
        const workspaces = await this.workspaceService.getWorkspaces(context.user.id, {
            limit: pageSize,
            offset: (req.pagination?.page || 0) * pageSize,
            organizationId: req.organizationId,
            pinnedOnly: req.pinned === true ? true : undefined,
            searchString: req.searchTerm,
        });
        const response = new ListWorkspacesResponse();
        response.workspaces = workspaces.rows.map((info) => this.apiConverter.toWorkspace(info));
        response.pagination = new PaginationResponse();
        response.pagination.total = workspaces.total;
        return response;
    }
}
