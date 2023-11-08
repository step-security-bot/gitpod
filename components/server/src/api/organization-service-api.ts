/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { inject, injectable } from "inversify";
import { OrganizationService as OrganizationServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/organization_connect";
import {
    CreateOrganizationRequest,
    CreateOrganizationResponse,
    DeleteOrganizationMemberRequest,
    DeleteOrganizationMemberResponse,
    DeleteOrganizationRequest,
    DeleteOrganizationResponse,
    GetOrganizationInvitationRequest,
    GetOrganizationInvitationResponse,
    GetOrganizationRequest,
    GetOrganizationResponse,
    JoinOrganizationRequest,
    JoinOrganizationResponse,
    ListOrganizationMembersRequest,
    ListOrganizationMembersResponse,
    ListOrganizationsRequest,
    ListOrganizationsResponse,
    ResetOrganizationInvitationRequest,
    ResetOrganizationInvitationResponse,
    UpdateOrganizationRequest,
    UpdateOrganizationResponse,
    UpdateOrganizationMemberRequest,
    UpdateOrganizationMemberResponse,
    GetOrganizationSettingsRequest,
    GetOrganizationSettingsResponse,
    UpdateOrganizationSettingsRequest,
    UpdateOrganizationSettingsResponse,
    ListOrganizationsRequest_Scope,
} from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { OrganizationService } from "../orgs/organization-service";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { ctx, userId } from "../util/request-context";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

@injectable()
export class OrganizationServiceAPI implements ServiceImpl<typeof OrganizationServiceInterface> {
    constructor(
        @inject(OrganizationService)
        private readonly orgService: OrganizationService,
        @inject(PublicAPIConverter)
        private readonly apiConverter: PublicAPIConverter,
    ) {}

    async createOrganization(req: CreateOrganizationRequest, _: HandlerContext): Promise<CreateOrganizationResponse> {
        // TODO(gpl) This mimicks the current behavior of adding the subjectId as owner
        const ownerId = ctx().subjectId?.userId();
        if (!ownerId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "No userId available");
        }
        const org = await this.orgService.createOrganization(ownerId, req.name);
        const response = new CreateOrganizationResponse();
        response.organization = this.apiConverter.toOrganization(org);
        return response;
    }

    async getOrganization(req: GetOrganizationRequest, _: HandlerContext): Promise<GetOrganizationResponse> {
        const org = await this.orgService.getOrganization(userId(), req.organizationId);
        const response = new GetOrganizationResponse();
        response.organization = this.apiConverter.toOrganization(org);
        return response;
    }

    async updateOrganization(
        req: UpdateOrganizationRequest,
        context: HandlerContext,
    ): Promise<UpdateOrganizationResponse> {
        const org = await this.orgService.updateOrganization(userId(), req.organizationId, {
            name: req.name,
        });
        return new UpdateOrganizationResponse({
            organization: this.apiConverter.toOrganization(org),
        });
    }

    async listOrganizations(
        req: ListOrganizationsRequest,
        context: HandlerContext,
    ): Promise<ListOrganizationsResponse> {
        const orgs = await this.orgService.listOrganizations(
            userId(),
            {
                limit: req.pagination?.pageSize || 100,
                offset: (req.pagination?.page || 0) * (req.pagination?.pageSize || 0),
            },
            req.scope === ListOrganizationsRequest_Scope.ALL ? "installation" : "member",
        );
        const response = new ListOrganizationsResponse();
        response.organizations = orgs.rows.map((org) => this.apiConverter.toOrganization(org));
        response.pagination = new PaginationResponse();
        response.pagination.total = orgs.total;
        return response;
    }

    async deleteOrganization(req: DeleteOrganizationRequest, _: HandlerContext): Promise<DeleteOrganizationResponse> {
        await this.orgService.deleteOrganization(userId(), req.organizationId);
        return new DeleteOrganizationResponse();
    }

    async getOrganizationInvitation(
        req: GetOrganizationInvitationRequest,
        _: HandlerContext,
    ): Promise<GetOrganizationInvitationResponse> {
        const invitation = await this.orgService.getOrCreateInvite(userId(), req.organizationId);
        const response = new GetOrganizationInvitationResponse();
        response.invitationId = invitation.id;
        return response;
    }

    async joinOrganization(req: JoinOrganizationRequest, _: HandlerContext): Promise<JoinOrganizationResponse> {
        const orgId = await this.orgService.joinOrganization(userId(), req.invitationId);
        const result = new JoinOrganizationResponse();
        result.organizationId = orgId;
        return result;
    }

    async resetOrganizationInvitation(
        req: ResetOrganizationInvitationRequest,
        _: HandlerContext,
    ): Promise<ResetOrganizationInvitationResponse> {
        const inviteId = await this.orgService.resetInvite(userId(), req.organizationId);
        const result = new ResetOrganizationInvitationResponse();
        result.invitationId = inviteId.id;
        return result;
    }

    async listOrganizationMembers(
        req: ListOrganizationMembersRequest,
        _: HandlerContext,
    ): Promise<ListOrganizationMembersResponse> {
        const members = await this.orgService.listMembers(userId(), req.organizationId);
        //TODO pagination
        const response = new ListOrganizationMembersResponse();
        response.members = members.map((member) => this.apiConverter.toOrganizationMember(member));
        response.pagination = new PaginationResponse();
        response.pagination.total = members.length;
        return response;
    }

    async updateOrganizationMember(
        req: UpdateOrganizationMemberRequest,
        _: HandlerContext,
    ): Promise<UpdateOrganizationMemberResponse> {
        await this.orgService.addOrUpdateMember(
            userId(),
            req.organizationId,
            req.userId,
            this.apiConverter.fromOrgMemberRole(req.role),
        );
        const member = await this.orgService
            .listMembers(userId(), req.organizationId)
            .then((members) => members.find((member) => member.userId === req.userId));
        return new UpdateOrganizationMemberResponse({
            member: member && this.apiConverter.toOrganizationMember(member),
        });
    }

    async deleteOrganizationMember(
        req: DeleteOrganizationMemberRequest,
        _: HandlerContext,
    ): Promise<DeleteOrganizationMemberResponse> {
        await this.orgService.removeOrganizationMember(userId(), req.organizationId, req.userId);
        return new DeleteOrganizationMemberResponse();
    }

    async getOrganizationSettings(
        req: GetOrganizationSettingsRequest,
        _: HandlerContext,
    ): Promise<GetOrganizationSettingsResponse> {
        const settings = await this.orgService.getSettings(userId(), req.organizationId);
        const response = new GetOrganizationSettingsResponse();
        response.settings = this.apiConverter.toOrganizationSettings(settings);
        return response;
    }

    async updateOrganizationSettings(
        req: UpdateOrganizationSettingsRequest,
        _: HandlerContext,
    ): Promise<UpdateOrganizationSettingsResponse> {
        const settings = await this.orgService.updateSettings(userId(), req.organizationId, {
            workspaceSharingDisabled: req.settings?.workspaceSharingDisabled,
            defaultWorkspaceImage: req.settings?.defaultWorkspaceImage,
        });
        return new UpdateOrganizationSettingsResponse({
            settings: this.apiConverter.toOrganizationSettings(settings),
        });
    }
}
