import { useState } from 'react';
import { useCreateChangeRequest } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile, CMSRole, Priority } from '../backend';
import { ExternalBlob } from '../backend';

interface CreateChangeRequestFormProps {
  userProfile: UserProfile;
}

export default function CreateChangeRequestForm({ userProfile }: CreateChangeRequestFormProps) {
  const [requesterName, setRequesterName] = useState(userProfile.name);
  const [email, setEmail] = useState(userProfile.email);
  const [contactNumber, setContactNumber] = useState(userProfile.contactNumber);
  const [project, setProject] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [impacted, setImpacted] = useState('');
  const [implementationPlan, setImplementationPlan] = useState<File | null>(null);
  const [rollbackPlan, setRollbackPlan] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ impl: number; rollback: number }>({
    impl: 0,
    rollback: 0,
  });

  const createRequest = useCreateChangeRequest();

  const canCreate = userProfile.cmsRole === CMSRole.changeRequester;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'impl' | 'rollback') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'impl') {
        setImplementationPlan(file);
      } else {
        setRollbackPlan(file);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canCreate) {
      toast.error('Only Change Requesters can create change requests');
      return;
    }

    if (!priority || !implementationPlan || !rollbackPlan) {
      toast.error('Please fill in all required fields and upload both plans');
      return;
    }

    try {
      // Convert files to ExternalBlob
      const implPlanBytes = new Uint8Array(await implementationPlan.arrayBuffer());
      const rollbackPlanBytes = new Uint8Array(await rollbackPlan.arrayBuffer());

      const implBlob = ExternalBlob.fromBytes(implPlanBytes).withUploadProgress((percentage) => {
        setUploadProgress((prev) => ({ ...prev, impl: percentage }));
      });

      const rollbackBlob = ExternalBlob.fromBytes(rollbackPlanBytes).withUploadProgress((percentage) => {
        setUploadProgress((prev) => ({ ...prev, rollback: percentage }));
      });

      const startDateTime = new Date(`${startDate}T${startTime}`).getTime() * 1000000;
      const endDateTime = new Date(`${endDate}T${endTime}`).getTime() * 1000000;

      const crId = await createRequest.mutateAsync({
        requesterName,
        email,
        contactNumber,
        project,
        description,
        reason,
        startDate: BigInt(startDateTime),
        endDate: BigInt(endDateTime),
        priority: priority as Priority,
        impacted,
        implementationPlan: implBlob,
        rollbackPlan: rollbackBlob,
      });

      toast.success(`Change request CR-${crId.toString()} created successfully!`);

      // Reset form
      setProject('');
      setDescription('');
      setReason('');
      setStartDate('');
      setStartTime('');
      setEndDate('');
      setEndTime('');
      setPriority('');
      setImpacted('');
      setImplementationPlan(null);
      setRollbackPlan(null);
      setUploadProgress({ impl: 0, rollback: 0 });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create change request');
      console.error(error);
    }
  };

  if (!canCreate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Create Change Request</CardTitle>
          <CardDescription>Submit a new change request for approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Access Restricted</p>
            <p className="text-sm text-muted-foreground mt-2">
              Only users with the Change Requester role can create change requests.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Create Change Request</h2>
        <p className="text-muted-foreground">Submit a new change request for approval</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Change Request Form</CardTitle>
            <CardDescription>Fill in all required information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Requester Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Requester Information</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="requesterName">Requester Name *</Label>
                  <Input
                    id="requesterName"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number *</Label>
                  <Input
                    id="contactNumber"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Change Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Change Details</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project">Project / Department *</Label>
                  <Input
                    id="project"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="e.g., Infrastructure Upgrade"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description of Change *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide a detailed description of the proposed change..."
                    rows={4}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Change *</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why this change is necessary..."
                    rows={3}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Planned Schedule</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Priority and Impact */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Priority & Impact</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                    <SelectTrigger id="priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={Priority.p1}>P1 - High</SelectItem>
                      <SelectItem value={Priority.p2}>P2 - Medium</SelectItem>
                      <SelectItem value={Priority.p3}>P3 - Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="impacted">Users / Applications Impacted *</Label>
                  <Input
                    id="impacted"
                    value={impacted}
                    onChange={(e) => setImpacted(e.target.value)}
                    placeholder="e.g., All users, Production database"
                    required
                  />
                </div>
              </div>
            </div>

            {/* File Uploads */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Documentation</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="implementationPlan">Implementation Plan *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="implementationPlan"
                      type="file"
                      onChange={(e) => handleFileChange(e, 'impl')}
                      accept=".pdf,.doc,.docx,.txt"
                      required
                    />
                    {implementationPlan && <FileText className="h-5 w-5 text-green-600" />}
                  </div>
                  {uploadProgress.impl > 0 && uploadProgress.impl < 100 && (
                    <p className="text-xs text-muted-foreground">Uploading: {uploadProgress.impl}%</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rollbackPlan">Rollback Plan *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="rollbackPlan"
                      type="file"
                      onChange={(e) => handleFileChange(e, 'rollback')}
                      accept=".pdf,.doc,.docx,.txt"
                      required
                    />
                    {rollbackPlan && <FileText className="h-5 w-5 text-green-600" />}
                  </div>
                  {uploadProgress.rollback > 0 && uploadProgress.rollback < 100 && (
                    <p className="text-xs text-muted-foreground">Uploading: {uploadProgress.rollback}%</p>
                  )}
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={createRequest.isPending}>
              {createRequest.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Change Request...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Submit Change Request
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
