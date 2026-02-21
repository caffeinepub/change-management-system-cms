import { useState } from 'react';
import { UserProfile } from '../backend';
import Header from '../components/Header';
import Footer from '../components/Footer';
import DashboardOverview from '../components/DashboardOverview';
import ChangeRequestList from '../components/ChangeRequestList';
import CreateChangeRequestForm from '../components/CreateChangeRequestForm';
import ChangeRequestDetails from '../components/ChangeRequestDetails';
import ReportsView from '../components/ReportsView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DashboardPageProps {
  userProfile: UserProfile;
}

export default function DashboardPage({ userProfile }: DashboardPageProps) {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedCRId, setSelectedCRId] = useState<bigint | null>(null);

  const handleViewDetails = (crId: bigint) => {
    setSelectedCRId(crId);
    setSelectedTab('details');
  };

  const handleBackToList = () => {
    setSelectedCRId(null);
    setSelectedTab('requests');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header userProfile={userProfile} />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="requests">Change Requests</TabsTrigger>
            <TabsTrigger value="create">Create New</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <DashboardOverview userProfile={userProfile} onViewDetails={handleViewDetails} />
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            <ChangeRequestList userProfile={userProfile} onViewDetails={handleViewDetails} />
          </TabsContent>

          <TabsContent value="create" className="space-y-6">
            <CreateChangeRequestForm userProfile={userProfile} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ReportsView />
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            {selectedCRId && (
              <ChangeRequestDetails crId={selectedCRId} userProfile={userProfile} onBack={handleBackToList} />
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
