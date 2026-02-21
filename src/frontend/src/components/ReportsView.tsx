import { useGetChangeRequestStats, useGetAllChangeRequests } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportsView() {
  const { data: stats, isLoading: statsLoading } = useGetChangeRequestStats();
  const { data: allRequests, isLoading: requestsLoading } = useGetAllChangeRequests();

  const handleExportReport = () => {
    if (!stats || !allRequests) {
      toast.error('No data available to export');
      return;
    }

    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: Number(stats.total),
        byPriority: {
          p1: Number(stats.byPriority.p1),
          p2: Number(stats.byPriority.p2),
          p3: Number(stats.byPriority.p3),
        },
        byStatus: {
          submitted: Number(stats.byStatus.submitted),
          underReview: Number(stats.byStatus.underReview),
          approved: Number(stats.byStatus.approved),
          implStarted: Number(stats.byStatus.implStarted),
          implDone: Number(stats.byStatus.implDone),
          closed: Number(stats.byStatus.closed),
          rejected: Number(stats.byStatus.rejected),
        },
        successRate: {
          successful: Number(stats.successRate.successful),
          failed: Number(stats.successRate.failed),
        },
      },
      requests: allRequests.map((r) => ({
        crId: r.crId.toString(),
        project: r.project,
        description: r.description,
        priority: r.priority,
        status: r.status,
        requesterName: r.requesterName,
        createdAt: new Date(Number(r.createdAt) / 1000000).toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cms-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Report exported successfully');
  };

  if (statsLoading || requestsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const priorityData = [
    { name: 'P1 - High', value: Number(stats?.byPriority.p1 || 0), color: '#ef4444' },
    { name: 'P2 - Medium', value: Number(stats?.byPriority.p2 || 0), color: '#f59e0b' },
    { name: 'P3 - Low', value: Number(stats?.byPriority.p3 || 0), color: '#10b981' },
  ];

  const statusData = [
    { name: 'Submitted', value: Number(stats?.byStatus.submitted || 0) },
    { name: 'Under Review', value: Number(stats?.byStatus.underReview || 0) },
    { name: 'Approved', value: Number(stats?.byStatus.approved || 0) },
    { name: 'Impl Started', value: Number(stats?.byStatus.implStarted || 0) },
    { name: 'Impl Done', value: Number(stats?.byStatus.implDone || 0) },
    { name: 'Closed', value: Number(stats?.byStatus.closed || 0) },
    { name: 'Rejected', value: Number(stats?.byStatus.rejected || 0) },
  ];

  const successData = [
    { name: 'Successful', value: Number(stats?.successRate.successful || 0), color: '#10b981' },
    { name: 'Failed', value: Number(stats?.successRate.failed || 0), color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-muted-foreground">Comprehensive insights and data export</p>
        </div>
        <Button onClick={handleExportReport}>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats ? Number(stats.total) : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats ? Number(stats.successRate.successful) : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats ? Number(stats.successRate.failed) : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats && Number(stats.successRate.successful) + Number(stats.successRate.failed) > 0
                ? (
                    (Number(stats.successRate.successful) /
                      (Number(stats.successRate.successful) + Number(stats.successRate.failed))) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Change requests by current status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="oklch(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
            <CardDescription>Change requests by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Implementation Success Rate</CardTitle>
            <CardDescription>Successful vs failed implementations</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={successData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {successData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
            <CardDescription>Complete history of all changes</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground text-center mb-4">
              All change requests include complete audit trails with timestamps and approval history
            </p>
            <Button variant="outline" onClick={handleExportReport}>
              <Download className="mr-2 h-4 w-4" />
              Export Audit Log
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
