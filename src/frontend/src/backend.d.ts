import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface UserProfile {
    cmsRole: CMSRole;
    name: string;
    email: string;
    contactNumber: string;
    department: string;
}
export type Time = bigint;
export interface ChangeRequestPublicSummary {
    status: ChangeRequestStatus;
    endDate: Time;
    crId: ChangeRequestId;
    createdAt: Time;
    lastUpdated: Time;
    description: string;
    priority: Priority;
    requesterName: string;
    project: string;
    startDate: Time;
    reason: string;
}
export interface ApprovalRecord {
    action: ApprovalAction;
    approverRole: CMSRole;
    approver: Principal;
    timestamp: Time;
    comments: string;
}
export interface ChangeRequest {
    status: ChangeRequestStatus;
    requester: Principal;
    implementationDetails?: ImplementationDetails;
    approvalHistory: Array<ApprovalRecord>;
    crId: ChangeRequestId;
    form: CRForm;
    createdAt: Time;
    lastUpdated: Time;
    assignedTeam?: Principal;
}
export interface ImplementationDetails {
    rcaDocument?: ExternalBlob;
    actualEndTime?: Time;
    success?: boolean;
    remarks: string;
    actualStartTime?: Time;
}
export type ChangeRequestId = bigint;
export interface CRForm {
    impacted: string;
    implementationPlan: ExternalBlob;
    endDate: Time;
    rollbackPlan: ExternalBlob;
    description: string;
    email: string;
    contactNumber: string;
    priority: Priority;
    requesterName: string;
    project: string;
    startDate: Time;
    reason: string;
}
export enum ApprovalAction {
    reject = "reject",
    approve = "approve",
    sendBack = "sendBack"
}
export enum CMSRole {
    informationSecurity = "informationSecurity",
    implementationTeam = "implementationTeam",
    changeReviewer = "changeReviewer",
    changeRequester = "changeRequester",
    dataCenterHelpdesk = "dataCenterHelpdesk",
    changeApprover = "changeApprover"
}
export enum ChangeRequestStatus {
    closed = "closed",
    implStarted = "implStarted",
    submitted = "submitted",
    underReview = "underReview",
    implDone = "implDone",
    approved = "approved",
    rejected = "rejected"
}
export enum Priority {
    p1 = "p1",
    p2 = "p2",
    p3 = "p3"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    assignImplementationTeam(crId: ChangeRequestId, teamMember: Principal): Promise<void>;
    closeChangeRequest(crId: ChangeRequestId): Promise<void>;
    createChangeRequest(form: CRForm): Promise<ChangeRequestId>;
    getAllPublicChangeRequests(): Promise<Array<ChangeRequestPublicSummary>>;
    getAllUserProfiles(): Promise<Array<[Principal, UserProfile]>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getChangeRequestById(crId: ChangeRequestId): Promise<ChangeRequest | null>;
    getChangeRequestStats(): Promise<{
        total: bigint;
        successRate: {
            successful: bigint;
            failed: bigint;
        };
        byStatus: {
            closed: bigint;
            implStarted: bigint;
            submitted: bigint;
            underReview: bigint;
            implDone: bigint;
            approved: bigint;
            rejected: bigint;
        };
        byPriority: {
            p1: bigint;
            p2: bigint;
            p3: bigint;
        };
    }>;
    getChangeRequestsByStatus(status: ChangeRequestStatus): Promise<Array<ChangeRequestPublicSummary>>;
    getRecentChangeRequests(timestamp: Time): Promise<Array<ChangeRequestPublicSummary>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    processApproval(crId: ChangeRequestId, action: ApprovalAction, comments: string): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateImplementationDetails(crId: ChangeRequestId, details: ImplementationDetails): Promise<void>;
}
