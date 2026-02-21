import { useState } from 'react';
import { useGetChangeRequestById, useProcessApproval, useAssignImplementationTeam, useUpdateImplementationDetails, useCloseChangeRequest, useGetAllUserProfiles } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle2, XCircle, ArrowLeftCircle, Clock, FileText, Download, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile, CMSRole, ApprovalAction, ChangeRequestId } from '../backend';
import { format } from 'date-fns';
import { ExternalBlob } from '../backend';
import { Principal } from '@dfinity/principal';

interface ChangeRequestDetailsProps {
  crId: ChangeRequestId;
  userProfile: UserProfile;
  onBack: () => void;
}

export default function ChangeRequestDetails({ crId, userProfile, onBack }: ChangeRequestDetailsProps) {
  const { identity } = useInternetIdentity();
  const { data: request, isLoading } = useGetChangeRequestById(crId);
  const { data: allProfiles } = useGetAllUserProfiles();
  const processApproval = useProcessApproval();
  const assignTeam = useAssignImplementationTeam();
  const updateImpl = useUpdateImplementationDetails();
  const closeRequest = useCloseChangeRequest();

  const [approvalComments, setApprovalComments] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ApprovalAction | null>(null);
  const [selectedTeamMember, setSelectedTeamMember] = useState('');
  const [actualStartDate, setActualStartDate] = useState('');
  const [actualStartTime, setActualStartTime] = useState('');
  const [actualEndDate, setActualEndDate] = useState('');
  const [actualEndTime, setActualEndTime] = useState('');
  const [implSuccess, setImplSuccess] = useState<boolean | null>(null);
  const [implRemarks, setImplRemarks] = useState('');
  const [rcaFile, setRcaFile] = useState<File | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!request) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Change request not found</p>
          <Button onClick={onBack} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canApprove = () => {
    const role = userProfile.cmsRole;
    const status = request.status;

    if (status === 'submitted' && role === CMSRole.changeReviewer) return true;
    if (status === 'underReview' && role === CMSRole.dataCenterHelpdesk) return true;
    if (status === 'underReview' && role === CMSRole.informationSecurity) {
      const helpdeskApproved = request.approvalHistory.some(
        (r) => r.approverRole === 'dataCenterHelpdesk' && r.action === 'approve'
      );
      return helpdeskApproved;
    }
    if (status === 'underReview' && role === CMSRole.changeApprover) {
      const infoSecApproved = request.approvalHistory.some(
        (r) => r.approverRole === 'informationSecurity' && r.action === 'approve'
      );
      return infoSecApproved;
    }
    return false;
  };

  const canAssignTeam = () => {
    return userProfile.cmsRole === CMSRole.dataCenterHelpdesk && (request.status === 'underReview' || request.status === 'approved');
  };

  const canUpdateImplementation = () => {
    if (userProfile.cmsRole !== CMSRole.implementationTeam) return false;
    if (!request.assignedTeam || !identity) return false;
    const isAssigned = request.assignedTeam.toString() === identity.getPrincipal().toString();
    return isAssigned && (request.status === 'approved' || request.status === 'implStarted' || request.status === 'implDone');
  };

  const canClose = () => {
    if (userProfile.cmsRole !== CMSRole.implementationTeam) return false;
    if (!request.assignedTeam || !identity) return false;
    const isAssigned = request.assignedTeam.toString() === identity.getPrincipal().toString();
    return isAssigned && request.status === 'implDone';
  };

  const handleApproval = async (action: ApprovalAction) => {
    setSelectedAction(action);
    setShowApprovalDialog(true);
  };

  const confirmApproval = async () => {
    if (!selectedAction) return;

    try {
      await processApproval.mutateAsync({
        crId,
        action: selectedAction,
        comments: approvalComments,
      });
      toast.success(`Change request ${selectedAction}d successfully`);
      setShowApprovalDialog(false);
      setApprovalComments('');
      setSelectedAction(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to process approval');
    }
  };

  const handleAssignTeam = async () => {
    if (!selectedTeamMember) {
      toast.error('Please select a team member');
      return;
    }

    try {
      const selectedProfile = allProfiles?.find(([_, p]) => p.name === selectedTeamMember);
      if (!selectedProfile) {
        toast.error('Selected team member not found');
        return;
      }

      await assignTeam.mutateAsync({
        crId,
        teamMember: selectedProfile[0],
      });
      toast.success('Implementation team assigned successfully');
      setSelectedTeamMember('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign team');
    }
  };

  const handleUpdateImplementation = async () => {
    try {
      let actualStart: bigint | undefined = undefined;
      let actualEnd: bigint | undefined = undefined;

      if (actualStartDate && actualStartTime) {
        actualStart = BigInt(new Date(`${actualStartDate}T${actualStartTime}`).getTime() * 1000000);
      }

      if (actualEndDate && actualEndTime) {
        actualEnd = BigInt(new Date(`${actualEndDate}T${actualEndTime}`).getTime() * 1000000);
      }

      let rcaBlob: ExternalBlob | undefined = undefined;
      if (rcaFile) {
        const rcaBytes = new Uint8Array(await rcaFile.arrayBuffer());
        rcaBlob = ExternalBlob.fromBytes(rcaBytes);
      }

      await updateImpl.mutateAsync({
        crId,
        details: {
          actualStartTime: actualStart,
          actualEndTime: actualEnd,
          success: implSuccess !== null ? implSuccess : undefined,
          remarks: implRemarks,
          rcaDocument: rcaBlob,
        },
      });
      toast.success('Implementation details updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update implementation');
    }
  };

  const handleClose = async () => {
    try {
      await closeRequest.mutateAsync(crId);
      toast.success('Change request closed successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to close request');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'p1':
        return 'destructive';
      case 'p2':
        return 'default';
      case 'p3':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'p1':
        return 'P1 - High';
      case 'p2':
        return 'P2 - Medium';
      case 'p3':
        return 'P3 - Low';
      default:
        return priority;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'underReview':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'approved':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'implStarted':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
      case 'implDone':
        return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400';
      case 'closed':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      case 'rejected':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      submitted: 'Submitted',
      underReview: 'Under Review',
      approved: 'Approved',
      implStarted: 'Implementation Started',
      implDone: 'Implementation Done',
      closed: 'Closed',
      rejected: 'Rejected',
    };
    return labels[status] || status;
  };

  const implementationTeamProfiles = allProfiles?.filter(([_, p]) => p.cmsRole === CMSRole.implementationTeam) || [];

  const getAssignedTeamMemberName = () => {
    if (!request.assignedTeam || !allProfiles) return 'Unknown';
    const assignedProfile = allProfiles.find(([p]) => p.toString() === request.assignedTeam?.toString());
    return assignedProfile ? assignedProfile[1].name : 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">CR-{crId.toString()}</h2>
            <p className="text-muted-foreground">{request.form.project}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getPriorityColor(request.form.priority)}>{getPriorityLabel(request.form.priority)}</Badge>
          <span className={`text-sm px-3 py-1 rounded-full ${getStatusColor(request.status)}`}>
            {getStatusLabel(request.status)}
          </span>
        </div>
      </div>

      {/* Request Details */}
      <Card>
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Requester Name</Label>
              <p className="font-medium">{request.form.requesterName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{request.form.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Contact Number</Label>
              <p className="font-medium">{request.form.contactNumber}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Project / Department</Label>
              <p className="font-medium">{request.form.project}</p>
            </div>
          </div>
          <Separator />
          <div>
            <Label className="text-muted-foreground">Description of Change</Label>
            <p className="mt-1">{request.form.description}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Reason for Change</Label>
            <p className="mt-1">{request.form.reason}</p>
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Planned Start</Label>
              <p className="font-medium">
                {format(new Date(Number(request.form.startDate) / 1000000), 'PPpp')}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Planned End</Label>
              <p className="font-medium">
                {format(new Date(Number(request.form.endDate) / 1000000), 'PPpp')}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Users / Applications Impacted</Label>
              <p className="font-medium">{request.form.impacted}</p>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Implementation Plan</Label>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <a href={request.form.implementationPlan.getDirectURL()} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
            <div>
              <Label className="text-muted-foreground">Rollback Plan</Label>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <a href={request.form.rollbackPlan.getDirectURL()} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval History */}
      <Card>
        <CardHeader>
          <CardTitle>Approval History</CardTitle>
          <CardDescription>Timeline of approvals and actions</CardDescription>
        </CardHeader>
        <CardContent>
          {request.approvalHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No approval actions yet</p>
          ) : (
            <div className="space-y-4">
              {request.approvalHistory.map((record, index) => (
                <div key={index} className="flex gap-4 border-l-2 border-primary/20 pl-4 pb-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {record.action === 'approve' && <CheckCircle2 className="inline h-4 w-4 text-green-600 mr-1" />}
                        {record.action === 'reject' && <XCircle className="inline h-4 w-4 text-red-600 mr-1" />}
                        {record.action === 'sendBack' && <ArrowLeftCircle className="inline h-4 w-4 text-yellow-600 mr-1" />}
                        {record.action === 'approve' ? 'Approved' : record.action === 'reject' ? 'Rejected' : 'Sent Back'}
                      </p>
                      <Badge variant="outline">{record.approverRole}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{record.comments}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(Number(record.timestamp) / 1000000), 'PPpp')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Actions */}
      {canApprove() && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>Your Action Required</CardTitle>
            <CardDescription>Review and approve or reject this change request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={() => handleApproval(ApprovalAction.approve)} disabled={processApproval.isPending}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleApproval(ApprovalAction.reject)}
                disabled={processApproval.isPending}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={() => handleApproval(ApprovalAction.sendBack)}
                disabled={processApproval.isPending}
              >
                <ArrowLeftCircle className="mr-2 h-4 w-4" />
                Send Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign Team */}
      {canAssignTeam() && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Implementation Team</CardTitle>
            <CardDescription>Select a team member to implement this change</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedTeamMember} onValueChange={setSelectedTeamMember}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {implementationTeamProfiles.map(([principal, profile]) => (
                    <SelectItem key={principal.toString()} value={profile.name}>
                      {profile.name} - {profile.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssignTeam} disabled={assignTeam.isPending || !selectedTeamMember}>
                {assignTeam.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4" />}
                Assign
              </Button>
            </div>
            {request.assignedTeam && (
              <p className="text-sm text-muted-foreground">
                Currently assigned to: {getAssignedTeamMemberName()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Implementation Details */}
      {canUpdateImplementation() && (
        <Card>
          <CardHeader>
            <CardTitle>Update Implementation Details</CardTitle>
            <CardDescription>Record actual implementation times and results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Actual Start Date</Label>
                <Input type="date" value={actualStartDate} onChange={(e) => setActualStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Actual Start Time</Label>
                <Input type="time" value={actualStartTime} onChange={(e) => setActualStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Actual End Date</Label>
                <Input type="date" value={actualEndDate} onChange={(e) => setActualEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Actual End Time</Label>
                <Input type="time" value={actualEndTime} onChange={(e) => setActualEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Implementation Result</Label>
              <Select value={implSuccess === null ? '' : implSuccess ? 'success' : 'failed'} onValueChange={(v) => setImplSuccess(v === 'success')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="success">Successful</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Implementation Remarks</Label>
              <Textarea value={implRemarks} onChange={(e) => setImplRemarks(e.target.value)} rows={3} />
            </div>
            {implSuccess === false && (
              <div className="space-y-2">
                <Label>RCA Document (for failures)</Label>
                <Input type="file" onChange={(e) => setRcaFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.txt" />
              </div>
            )}
            <Button onClick={handleUpdateImplementation} disabled={updateImpl.isPending}>
              {updateImpl.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update Implementation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Implementation Details Display */}
      {request.implementationDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Implementation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {request.implementationDetails.actualStartTime && (
                <div>
                  <Label className="text-muted-foreground">Actual Start Time</Label>
                  <p className="font-medium">
                    {format(new Date(Number(request.implementationDetails.actualStartTime) / 1000000), 'PPpp')}
                  </p>
                </div>
              )}
              {request.implementationDetails.actualEndTime && (
                <div>
                  <Label className="text-muted-foreground">Actual End Time</Label>
                  <p className="font-medium">
                    {format(new Date(Number(request.implementationDetails.actualEndTime) / 1000000), 'PPpp')}
                  </p>
                </div>
              )}
              {request.implementationDetails.success !== undefined && (
                <div>
                  <Label className="text-muted-foreground">Result</Label>
                  <p className="font-medium">
                    {request.implementationDetails.success ? (
                      <span className="text-green-600">Successful</span>
                    ) : (
                      <span className="text-red-600">Failed</span>
                    )}
                  </p>
                </div>
              )}
            </div>
            {request.implementationDetails.remarks && (
              <div>
                <Label className="text-muted-foreground">Remarks</Label>
                <p className="mt-1">{request.implementationDetails.remarks}</p>
              </div>
            )}
            {request.implementationDetails.rcaDocument && (
              <div>
                <Label className="text-muted-foreground">RCA Document</Label>
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <a href={request.implementationDetails.rcaDocument.getDirectURL()} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Download RCA
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Close Request */}
      {canClose() && (
        <Card>
          <CardHeader>
            <CardTitle>Close Change Request</CardTitle>
            <CardDescription>Mark this change request as closed</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleClose} disabled={closeRequest.isPending}>
              {closeRequest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Close Request
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAction === ApprovalAction.approve && 'Approve Change Request'}
              {selectedAction === ApprovalAction.reject && 'Reject Change Request'}
              {selectedAction === ApprovalAction.sendBack && 'Send Back Change Request'}
            </DialogTitle>
            <DialogDescription>Please provide comments for your decision</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comments">Comments *</Label>
              <Textarea
                id="comments"
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                placeholder="Enter your comments..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmApproval} disabled={processApproval.isPending || !approvalComments}>
              {processApproval.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
