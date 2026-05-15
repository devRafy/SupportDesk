import Layout from "@/components/layout";
import { useGetAnalyticsSummary, useGetAgentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Tooltip,
} from "recharts";
import { getGetAnalyticsSummaryQueryKey, getGetAgentActivityQueryKey } from "@workspace/api-client-react";
import { MessageSquare, Users, Clock, CheckCircle, TrendingUp, Percent } from "lucide-react";

const COLORS = ["hsl(239,84%,67%)", "hsl(160,60%,45%)", "hsl(30,80%,55%)", "hsl(280,65%,60%)"];

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const { data: summary, isLoading: summaryLoading } = useGetAnalyticsSummary({
    query: { queryKey: getGetAnalyticsSummaryQueryKey() }
  });
  const { data: activity, isLoading: activityLoading } = useGetAgentActivity({
    query: { queryKey: getGetAgentActivityQueryKey() }
  });

  const statusData = (summary?.byStatus ?? []).map(s => ({ name: s.status, value: Number(s.count) }));

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-bold">Analytics</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Support performance overview</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>)
            ) : (
              <>
                <StatCard label="Today" value={summary?.totalToday ?? 0} icon={MessageSquare} sub="Conversations today" />
                <StatCard label="This week" value={summary?.totalThisWeek ?? 0} icon={TrendingUp} sub="Conversations this week" />
                <StatCard label="Resolution rate" value={`${Math.round((summary?.resolutionRate ?? 0) * 100)}%`} icon={Percent} sub="Closed conversations" />
                <StatCard
                  label="Avg first response"
                  value={summary?.avgFirstResponseMs ? `${Math.round(summary.avgFirstResponseMs / 60000)}m` : "—"}
                  icon={Clock}
                  sub="Response time"
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Conversation status</CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? <Skeleton className="h-48 w-full" /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={10} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Agent activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activityLoading ? <Skeleton className="h-48 w-full" /> : (
                  <div className="space-y-3 mt-1">
                    {(activity ?? []).map((a) => (
                      <div key={a.agentId} className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3.5 h-3.5 text-primary" />
                          </div>
                          {a.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.conversationCount} conversations</p>
                        </div>
                      </div>
                    ))}
                    {(activity ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No agent data yet</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
