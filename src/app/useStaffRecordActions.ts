import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ApiError, apiRequest } from '../api';
import {
  ApiPage,
  Farmer,
  FieldReport,
  ReviewForm,
  StaffSession,
  StaffVisit,
  VisitCheckingInput,
} from '../types';
import {
  PendingReview,
  readPendingReviews,
  savePendingReviews,
} from '../offlineStore';
import { reportIsCompleteWithoutVisit, reviewFromReport } from './reportReview';
import { syncFollowUpVisit } from './followUpVisits';

export type LoadMoreKind = 'reports' | 'farmers' | 'visits';
type Setter<T> = Dispatch<SetStateAction<T>>;
type NoticeKind = 'error' | 'success' | 'info';

function reportHasReview(report: FieldReport) {
  return Boolean(
    report.verification_status !== 'For verification' ||
      report.sra_severity ||
      report.assessment_rationale?.trim() ||
      report.reviewer_note?.trim() ||
      report.follow_up_at,
  );
}

type StaffRecordActionOptions = {
  session: StaffSession | null;
  online: boolean;
  setOnline: Setter<boolean>;
  reports: FieldReport[];
  setReports: Setter<FieldReport[]>;
  farmers: Farmer[];
  setFarmers: Setter<Farmer[]>;
  visits: StaffVisit[];
  setVisits: Setter<StaffVisit[]>;
  selectedReport: FieldReport | null;
  setSelectedReport: Setter<FieldReport | null>;
  selectedFarmer: Farmer | null;
  setSelectedFarmer: Setter<Farmer | null>;
  setBusy: Setter<boolean>;
  review: ReviewForm | null;
  setReview: Setter<ReviewForm | null>;
  reviewBusy: boolean;
  setReviewBusy: Setter<boolean>;
  photoFailed: number[];
  setPhotoFailed: Setter<number[]>;
  setPendingReviewCount: Setter<number>;
  loadingMore: LoadMoreKind | null;
  setLoadingMore: Setter<LoadMoreKind | null>;
  refreshing: boolean;
  reportTotal: number;
  setReportTotal: Setter<number>;
  reportPage: number;
  setReportPage: Setter<number>;
  farmerTotal: number;
  setFarmerTotal: Setter<number>;
  farmerPage: number;
  setFarmerPage: Setter<number>;
  visitTotal: number;
  setVisitTotal: Setter<number>;
  visitPage: number;
  setVisitPage: Setter<number>;
  setVisitBusy: Setter<boolean>;
  listFilter: string;
  search: string;
  showNotice: (message: string, kind?: NoticeKind) => void;
  addNotification: (title: string, message: string) => void;
  refreshData: () => Promise<void>;
};

export function useStaffRecordActions(options: StaffRecordActionOptions) {
  const {
    session,
    online,
    setOnline,
    reports,
    setReports,
    farmers,
    setFarmers,
    visits,
    setVisits,
    selectedReport,
    setSelectedReport,
    selectedFarmer,
    setSelectedFarmer,
    setBusy,
    review,
    setReview,
    reviewBusy,
    setReviewBusy,
    photoFailed,
    setPhotoFailed,
    setPendingReviewCount,
    loadingMore,
    setLoadingMore,
    refreshing,
    reportTotal,
    setReportTotal,
    reportPage,
    setReportPage,
    farmerTotal,
    setFarmerTotal,
    farmerPage,
    setFarmerPage,
    visitTotal,
    setVisitTotal,
    visitPage,
    setVisitPage,
    setVisitBusy,
    listFilter,
    search,
    showNotice,
    addNotification,
    refreshData,
  } = options;

  const openReport = async (reportOrId: FieldReport | number) => {
    if (!session) return false;
    const reportId =
      typeof reportOrId === 'number' ? reportOrId : reportOrId.id;
    const cachedReport =
      typeof reportOrId === 'number'
        ? reports.find(item => item.id === reportId)
        : reportOrId;
    setBusy(true);
    setSelectedFarmer(null);
    try {
      if (!online) {
        if (!cachedReport) {
          showNotice('Connect to load this report’s full details.', 'info');
          return false;
        }
        setSelectedReport(cachedReport);
        setReview(reviewFromReport(cachedReport));
        setPhotoFailed([]);
        return true;
      }
      const response = await apiRequest<{ data: FieldReport }>(
        `/staff/reports/${reportId}`,
        session.token,
      );
      setSelectedReport(response.data);
      setReports(items =>
        items.map(item =>
          item.id === response.data.id ? response.data : item,
        ),
      );
      setReview(reviewFromReport(response.data));
      setPhotoFailed([]);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setOnline(false);
        if (cachedReport) {
          setSelectedReport(cachedReport);
          setReview(reviewFromReport(cachedReport));
          setPhotoFailed([]);
        } else {
          showNotice('Connect to load this report’s full details.', 'info');
        }
        return Boolean(cachedReport);
      }
      showNotice(
        error instanceof Error ? error.message : 'Could not load this report.',
        'error',
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openFarmer = async (farmer: Farmer) => {
    if (!session) return;
    setBusy(true);
    setSelectedReport(null);
    try {
      if (!online) {
        setSelectedFarmer(farmer);
        return;
      }
      const response = await apiRequest<{ data: Farmer }>(
        `/staff/farmers/${farmer.id}`,
        session.token,
      );
      setSelectedFarmer(response.data);
      setFarmers(items =>
        items.map(item =>
          item.id === response.data.id ? response.data : item,
        ),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setOnline(false);
        setSelectedFarmer(farmer);
        return;
      }
      showNotice(
        error instanceof Error ? error.message : 'Could not load this farmer.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const queueReviewLocally = async () => {
    if (!session || !selectedReport || !review) return;
    const optimistic: FieldReport = {
      ...selectedReport,
      verification_status: review.verificationStatus,
      sra_severity:
        review.sraSeverity === 'Not assessed' ? null : review.sraSeverity,
      assessment_rationale: review.assessmentRationale,
      reviewer_note: review.reviewerNote,
      follow_up_at: review.followUpAt || null,
    };
    const current = await readPendingReviews(session.user.id);
    const next: PendingReview[] = [
      ...current.filter(item => item.reportId !== selectedReport.id),
      {
        reportId: selectedReport.id,
        review,
        previousFollowUpAt: selectedReport.follow_up_at || '',
        updatedAt: new Date().toISOString(),
      },
    ];
    await savePendingReviews(session.user.id, next);
    setPendingReviewCount(next.length);
    setSelectedReport(optimistic);
    setReports(items =>
      items.map(item => (item.id === optimistic.id ? optimistic : item)),
    );
    addNotification(
      'Review saved on this device',
      `${
        selectedReport.code
      } is queued and will sync when you are back online.${
        review.followUpAt
          ? ' Its follow-up visit will be scheduled during sync.'
          : ''
      }`,
    );
    showNotice(
      review.followUpAt
        ? 'Review saved on this device. The follow-up visit will be scheduled when you reconnect.'
        : 'Review saved on this device. It will sync when you reconnect.',
      'success',
    );
  };

  const submitReview = async () => {
    if (!session || !selectedReport || !review) return;
    if (reportIsCompleteWithoutVisit(selectedReport)) {
      showNotice('This report is complete and locked for editing.', 'info');
      return;
    }
    if (!session.scopes.includes('reports:review')) {
      showNotice(
        'This staff account can view reports but cannot submit reviews.',
        'error',
      );
      return;
    }
    const followUpAt = review.followUpAt.trim();
    if (followUpAt && !/^\d{4}-\d{2}-\d{2}$/.test(followUpAt)) {
      showNotice('Enter the follow-up date as YYYY-MM-DD.', 'error');
      return;
    }
    if (!online) {
      await queueReviewLocally();
      return;
    }
    setReviewBusy(true);
    try {
      const response = await apiRequest<{ data: FieldReport }>(
        `/staff/reports/${selectedReport.id}/review`,
        session.token,
        {
          method: 'PUT',
          body: JSON.stringify({
            verificationStatus: review.verificationStatus,
            sraSeverity:
              review.sraSeverity === 'Not assessed'
                ? 'Not assessed'
                : review.sraSeverity || null,
            assessmentRationale: review.assessmentRationale.trim() || null,
            reviewerNote: review.reviewerNote.trim() || null,
            followUpAt: followUpAt || null,
          }),
        },
      );
      setSelectedReport(response.data);
      setReports(items =>
        items.map(item =>
          item.id === response.data.id ? response.data : item,
        ),
      );
      setReview({
        verificationStatus: response.data.verification_status,
        sraSeverity: response.data.sra_severity || 'Not assessed',
        assessmentRationale: response.data.assessment_rationale || '',
        reviewerNote: response.data.reviewer_note || '',
        followUpAt: response.data.follow_up_at || '',
      });
      let followUpSyncFailed = false;
      if (followUpAt || selectedReport.follow_up_at) {
        setVisitBusy(true);
        try {
          const result = await syncFollowUpVisit(
            selectedReport.id,
            followUpAt,
            session.token,
            visits,
          );
          if (result.visit) {
            setVisits(items =>
              result.created
                ? [result.visit as StaffVisit, ...items]
                : items.map(item =>
                    item.id === result.visit?.id ? result.visit : item,
                  ),
            );
            if (result.created) setVisitTotal(total => total + 1);
          }
        } catch {
          followUpSyncFailed = true;
        } finally {
          setVisitBusy(false);
        }
      }
      showNotice(
        followUpSyncFailed
          ? 'Review saved, but the follow-up visit could not be synchronized. Retry from the report or Visits.'
          : followUpAt
          ? 'Review saved and follow-up visit scheduled.'
          : 'Review saved to the RSSI workspace.',
        followUpSyncFailed ? 'error' : 'success',
      );
      void refreshData();
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setOnline(false);
        await queueReviewLocally();
        return;
      }
      showNotice(
        error instanceof Error ? error.message : 'Review could not be saved.',
        'error',
      );
    } finally {
      setReviewBusy(false);
    }
  };

  const loadMore = async (kind: 'reports' | 'farmers' | 'visits') => {
    if (!session?.token || loadingMore || refreshing) return;
    setLoadingMore(kind);
    const nextPage =
      kind === 'reports'
        ? reportPage + 1
        : kind === 'visits'
        ? visitPage + 1
        : farmerPage + 1;
    try {
      if (kind === 'reports') {
        const response = await apiRequest<ApiPage<FieldReport>>(
          `/staff/reports?page=${nextPage}&pageSize=50`,
          session.token,
        );
        setReports(items => {
          const knownIds = new Set(items.map(item => item.id));
          return [
            ...items,
            ...response.data.filter(item => !knownIds.has(item.id)),
          ];
        });
        setReportTotal(response.meta?.total ?? reportTotal);
        setReportPage(response.meta?.page ?? nextPage);
      } else if (kind === 'visits') {
        const response = await apiRequest<ApiPage<StaffVisit>>(
          `/staff/visits?page=${nextPage}&pageSize=50`,
          session.token,
        );
        setVisits(items => {
          const knownIds = new Set(items.map(item => item.id));
          return [
            ...items,
            ...response.data.filter(item => !knownIds.has(item.id)),
          ];
        });
        setVisitTotal(response.meta?.total ?? visitTotal);
        setVisitPage(response.meta?.page ?? nextPage);
      } else {
        const response = await apiRequest<ApiPage<Farmer>>(
          `/staff/farmers?page=${nextPage}&pageSize=50`,
          session.token,
        );
        setFarmers(items => {
          const knownIds = new Set(items.map(item => item.id));
          return [
            ...items,
            ...response.data.filter(item => !knownIds.has(item.id)),
          ];
        });
        setFarmerTotal(response.meta?.total ?? farmerTotal);
        setFarmerPage(response.meta?.page ?? nextPage);
      }
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : 'Could not load more records.',
        'error',
      );
    } finally {
      setLoadingMore(null);
    }
  };

  const createVisit = async (
    reportId: number,
    values: {
      scheduledAt: string;
      visitFindings: string;
      checkings: VisitCheckingInput[];
    },
  ): Promise<StaffVisit | null> => {
    if (!session?.token || !online) return null;
    setVisitBusy(true);
    try {
      const response = await apiRequest<{ data: StaffVisit }>(
        `/staff/reports/${reportId}/visits`,
        session.token,
        { method: 'POST', body: JSON.stringify(values) },
      );
      setVisits(items => [response.data, ...items]);
      setVisitTotal(total => total + 1);
      showNotice('Follow-up visit scheduled.', 'success');
      return response.data;
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : 'Visit could not be scheduled.',
        'error',
      );
      return null;
    } finally {
      setVisitBusy(false);
    }
  };

  const updateVisit = async (
    visitId: number,
    values: {
      status: StaffVisit['status'];
      scheduledAt: string;
      visitFindings: string;
      checkings: VisitCheckingInput[];
    },
  ): Promise<StaffVisit | null> => {
    if (!session?.token || !online) return null;
    setVisitBusy(true);
    try {
      const response = await apiRequest<{ data: StaffVisit }>(
        `/staff/visits/${visitId}`,
        session.token,
        { method: 'PUT', body: JSON.stringify(values) },
      );
      setVisits(items =>
        items.map(item => (item.id === visitId ? response.data : item)),
      );
      showNotice(
        response.data.status === 'completed'
          ? 'Visit findings saved and visit completed.'
          : response.data.status === 'cancelled'
          ? 'Visit cancelled.'
          : 'Visit record saved.',
        'success',
      );
      return response.data;
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : 'Visit record could not be saved.',
        'error',
      );
      return null;
    } finally {
      setVisitBusy(false);
    }
  };

  const filteredReports = useMemo(
    () =>
      reports.filter(report => {
        const matchesFilter =
          listFilter === 'All' ||
          (listFilter === 'Confirmed'
            ? report.verification_status === 'Confirmed'
            : listFilter === 'Reviewed'
            ? reportHasReview(report) &&
              report.verification_status !== 'Confirmed'
            : listFilter === 'Needs review' || listFilter === 'For verification'
            ? !reportHasReview(report)
            : report.verification_status === listFilter);
        const query = search.trim().toLocaleLowerCase();
        const matchesSearch =
          !query ||
          [
            report.code,
            report.property_name,
            report.province,
            report.municipality,
            report.farmer?.name,
          ].some(value => value?.toLocaleLowerCase().includes(query));
        return matchesFilter && matchesSearch;
      }),
    [listFilter, reports, search],
  );
  const filteredFarmers = useMemo(
    () =>
      farmers.filter(farmer => {
        const query = search.trim().toLocaleLowerCase();
        return (
          !query ||
          [
            farmer.name,
            farmer.email,
            farmer.reference,
            ...farmer.properties.map(
              property =>
                `${property.name} ${property.municipality} ${property.province}`,
            ),
          ].some(value => value?.toLocaleLowerCase().includes(query))
        );
      }),
    [farmers, search],
  );

  const canReview = Boolean(session?.scopes.includes('reports:review'));
  const severeTotal = reports.filter(item =>
    ['Severe', 'Highly severe'].includes(item.farmer_severity),
  ).length;

  return {
    openReport,
    openFarmer,
    submitReview,
    loadMore,
    createVisit,
    updateVisit,
    filteredReports,
    filteredFarmers,
    canReview,
    severeTotal,
  };
}
