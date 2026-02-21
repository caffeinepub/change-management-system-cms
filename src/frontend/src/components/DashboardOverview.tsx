import { useGetChangeRequestStats, useGetAllChangeRequests } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { UserProfile, CMSRole, ChangeRequestPublicSummary } from '../backend';
import { formatDistanceToNow } from 'date-fns';

interface DashboardOverviewProps {
  userProfile: UserProfile;
  onViewDetails: (crId: bigint) => void;
}

export default function DashboardOverview({ userProfile, onViewDetails }: DashboardOverviewProps) {
  const { data: stats, isLoading: statsLoading } = useGetChangeRequestStats();
  const { data: allRequests, isLoading: requestsLoading } = useGetAllChangeRequests();

  const getPendingForRole = (role: CMSRole, requests: ChangeRequestPublicSummary[] | undefined) => {
    if (!requests) return [];

    switch (role) {
      case CMSRole.changeReviewer:
        return requests.filter((r) => r.status === 'submitted');
      case CMSRole.dataCenterHelpdesk:
        return requests.filter((r) => r.status === 'underReview');
      case CMSRole.informationSecurity:
        return requests.filter((r) => r.status === 'underReview');
      case CMSRole.changeApprover:
        return requests.filter((r) => r.status === 'underReview');
      case CMSRole.implementationTeam:
        return requests.filter((r) => r.status === 'approved' || r.status === 'implStarted');
      default:
        return [];
    }
  };

  const pendingRequests = getPendingForRole(userProfile.cmsRole, allRequests);
  const recentRequests = allRequests?.slice(0, 5) || [];

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

  if (statsLoading || requestsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const successRate =
    stats && Number(stats.successRate.successful) + Number(stats.successRate.failed) > 0
      ? (Number(stats.successRate.successful) /
          (Number(stats.successRate.successful) + Number(stats.successRate.failed))) *
        100
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-muted-foreground">Welcome back, {userProfile.name}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats ? Number(stats.total) : 0}</div>
            <p className="text-xs text-muted-foreground">All change requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting your action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats ? Number(stats.successRate.successful) : 0} successful implementations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats ? Number(stats.byPriority.p1) : 0}</div>
            <p className="text-xs text-muted-foreground">P1 requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Priority Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Priority Distribution</CardTitle>
          <CardDescription>Change requests by priority level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">P1 - High</p>
                <p className="text-2xl font-bold">{stats ? Number(stats.byPriority.p1) : 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">P2 - Medium</p>
                <p className="text-2xl font-bold">{stats ? Number(stats.byPriority.p2) : 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">P3 - Low</p>
                <p className="text-2xl font-bold">{stats ? Number(stats.byPriority.p3) : 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Change Requests</CardTitle>
          <CardDescription>Latest submissions and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentRequests.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No change requests yet</p>
            ) : (
              recentRequests.map((request) => (
                <div
                  key={request.crId.toString()}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">CR-{request.crId.toString()}</p>
                      <Badge variant={getPriorityColor(request.priority)}>
                        {getPriorityLabel(request.priority)}
                      </Badge>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(request.status)}`}>
                        {getStatusLabel(request.status)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{request.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(Number(request.createdAt) / 1000000), { addSuffix: true })}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onViewDetails(request.crId)}>
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Actions */}
      {pendingRequests.length > 0 && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Your Action
            </CardTitle>
            <CardDescription>These requests require your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.slice(0, 3).map((request) => (
                <div
                  key={request.crId.toString()}
                  className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-4"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">CR-{request.crId.toString()}</p>
                      <Badge variant={getPriorityColor(request.priority)}>
                        {getPriorityLabel(request.priority)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{request.description}</p>
                  </div>
                  <Button onClick={() => onViewDetails(request.crId)}>
                    Review
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
