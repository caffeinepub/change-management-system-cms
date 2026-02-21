import { useState } from 'react';
import { useGetAllChangeRequests } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Filter, Eye } from 'lucide-react';
import { UserProfile, ChangeRequestPublicSummary } from '../backend';
import { formatDistanceToNow } from 'date-fns';

interface ChangeRequestListProps {
  userProfile: UserProfile;
  onViewDetails: (crId: bigint) => void;
}

export default function ChangeRequestList({ userProfile, onViewDetails }: ChangeRequestListProps) {
  const { data: requests, isLoading } = useGetAllChangeRequests();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const filteredRequests = requests?.filter((request) => {
    const matchesSearch =
      searchTerm === '' ||
      request.crId.toString().includes(searchTerm) ||
      request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.project.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Change Requests</h2>
        <p className="text-muted-foreground">View and manage all change requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter change requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by CR-ID, description, or project..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="underReview">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="implStarted">Implementation Started</SelectItem>
                <SelectItem value="implDone">Implementation Done</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="p1">P1 - High</SelectItem>
                <SelectItem value="p2">P2 - Medium</SelectItem>
                <SelectItem value="p3">P3 - Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Requests ({filteredRequests?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {!filteredRequests || filteredRequests.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No change requests found</p>
            ) : (
              filteredRequests.map((request) => (
                <div
                  key={request.crId.toString()}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">CR-{request.crId.toString()}</p>
                      <Badge variant={getPriorityColor(request.priority)}>
                        {getPriorityLabel(request.priority)}
                      </Badge>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(request.status)}`}>
                        {getStatusLabel(request.status)}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{request.project}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{request.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Requester: {request.requesterName}</span>
                      <span>•</span>
                      <span>
                        Created {formatDistanceToNow(new Date(Number(request.createdAt) / 1000000), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onViewDetails(request.crId)}>
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
