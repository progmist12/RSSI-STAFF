import { apiRequest } from '../api';
import { StaffVisit, VisitCheckingInput } from '../types';

export async function syncFollowUpVisit(
  reportId: number,
  followUpAt: string,
  token: string,
  existingVisits: StaffVisit[],
): Promise<{ visit: StaffVisit | null; created: boolean }> {
  const scheduled = existingVisits.find(
    visit => visit.report_id === reportId && visit.status === 'scheduled',
  );

  if (!followUpAt) {
    if (!scheduled) return { visit: null, created: false };
    const response = await apiRequest<{ data: StaffVisit }>(
      `/staff/visits/${scheduled.id}`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify({
          status: 'cancelled',
          scheduledAt: scheduled.scheduled_at.slice(0, 10),
          visitFindings: scheduled.visit_findings || '',
          checkings: scheduled.checkings.map(
            (item): VisitCheckingInput => ({
              label: item.label,
              result: item.result,
              finding: item.finding || '',
            }),
          ),
        }),
      },
    );
    return { visit: response.data, created: false };
  }

  if (scheduled && scheduled.scheduled_at.slice(0, 10) === followUpAt) {
    return { visit: null, created: false };
  }

  if (scheduled) {
    const response = await apiRequest<{ data: StaffVisit }>(
      `/staff/visits/${scheduled.id}`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify({
          status: 'scheduled',
          scheduledAt: followUpAt,
          visitFindings: scheduled.visit_findings || '',
          checkings: scheduled.checkings.map(
            (item): VisitCheckingInput => ({
              label: item.label,
              result: item.result,
              finding: item.finding || '',
            }),
          ),
        }),
      },
    );
    return { visit: response.data, created: false };
  }

  const response = await apiRequest<{ data: StaffVisit }>(
    `/staff/reports/${reportId}/visits`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        scheduledAt: followUpAt,
        visitFindings: '',
        checkings: [],
      }),
    },
  );
  return { visit: response.data, created: true };
}
