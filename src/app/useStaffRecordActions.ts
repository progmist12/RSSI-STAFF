import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ApiError, apiRequest } from '../api';
import {
  ApiPage,
  CropCharacteristics,
  Farmer,
  FieldReport,
  ReviewForm,
  StaffSession,
  StaffVisit,
  VisitCheckingInput,
} from '../types';
import {
  PendingVisitChange,
  PendingReview,
  readPendingReviews,
  readPendingVisitChanges,
  savePendingReviews,
  savePendingVisitChanges,
} from '../offlineStore';
import { reportHasReview, reportIsCompleteWithoutVisit, reportWorkflowStage, reviewFromReport, reviewPayload } from './reportReview';
import { visitPayloadForApi } from './visitPayload';

export type LoadMoreKind = 'reports' | 'farmers' | 'visits';
type Setter<T> = Dispatch<SetStateAction<T>>;
type NoticeKind = 'error' | 'success' | 'info';

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
  pendingVisitChanges: PendingVisitChange[];
  setPendingVisitChanges: Setter<PendingVisitChange[]>;
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
    pendingVisitChanges,
    setPendingVisitChanges,
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

  const mergeReviewVisit = (visit: StaffVisit | null | undefined) => {
    if (!visit) return;
    const wasLoaded = visits.some(item => item.id === visit.id);
    setVisits(items =>
      wasLoaded
        ? items.map(item => (item.id === visit.id ? visit : item))
        : visit.status === 'scheduled'
        ? [visit, ...items]
        : items,
    );
    if (!wasLoaded && visit.status === 'scheduled') {
      setVisitTotal(total => total + 1);
    }
  };

  const queueVisitLocally = async (
    kind: PendingVisitChange['kind'],
    reportId: number,
    visit: StaffVisit,
    payload: PendingVisitChange['payload'],
    expectedUpdatedAt: string | null,
    conflict?: { message: string; remoteVisit?: StaffVisit | null },
    baseVisit?: StaffVisit | null,
  ) => {
    if (!session) return null;
    const current = await readPendingVisitChanges(session.user.id);
    const existing = current.find(item =>
      visit.id < 0
        ? item.localVisit.id === visit.id ||
          (item.kind === 'create' && item.reportId === reportId)
        : item.visitId === visit.id,
    );
    const change: PendingVisitChange = {
      id: existing?.id || `visit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: existing?.kind === 'create' ? 'create' : kind,
      reportId,
      visitId: existing?.kind === 'create' ? null : visit.id,
      localVisit: { ...visit, sync_state: conflict ? 'conflict' : existing?.state || 'pending' },
      baseVisit: existing?.baseVisit ?? baseVisit ?? null,
      expectedUpdatedAt: existing?.expectedUpdatedAt ?? expectedUpdatedAt,
      payload,
      state: conflict ? 'conflict' : existing?.state || 'pending',
      conflictMessage: conflict?.message || existing?.conflictMessage,
      remoteVisit: conflict?.remoteVisit ?? existing?.remoteVisit,
      savedAt: new Date().toISOString(),
    };
    const next = [...current.filter(item => item.id !== existing?.id), change];
    await savePendingVisitChanges(session.user.id, next);
    setPendingVisitChanges(next);
    setVisits(items => {
      const alreadyLoaded = items.some(item => item.id === visit.id);
      return alreadyLoaded
        ? items.map(item => item.id === visit.id ? change.localVisit : item)
        : [change.localVisit, ...items];
    });
    showNotice(
      conflict
        ? 'The server has a newer visit record. Resolve the conflict below.'
        : 'Visit saved on this device and waiting to sync.',
      conflict ? 'error' : 'success',
    );
    return change.localVisit;
  };

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

  const queueReviewLocally = async (nextStep: 'needed' | 'complete') => {
    if (!session || !selectedReport || !review) return false;
    const optimistic: FieldReport = {
      ...selectedReport,
      review_pending: true,
      verification_status: review.verificationStatus,
      sra_severity:
        review.sraSeverity === 'Not assessed' ? null : review.sraSeverity,
      assessment_rationale: review.assessmentRationale,
      reviewer_note: review.reviewerNote,
      farmer_message: review.farmerMessage || '',
      follow_up_at: nextStep === 'needed' ? review.followUpAt || null : null,
      review_completed_at:
        nextStep === 'complete' &&
        !review.followUpAt &&
        ['Confirmed', 'No detection'].includes(review.verificationStatus)
          ? new Date().toISOString()
          : null,
      sra_crop_assessment: {
        plant_height_cm: review.plantHeightCm ? Number(review.plantHeightCm) : null,
        leaves_per_stalk: review.leavesPerStalk ? Number(review.leavesPerStalk) : null,
        leaf_length_cm: review.leafLengthCm ? Number(review.leafLengthCm) : null,
        leaf_width_cm: review.leafWidthCm ? Number(review.leafWidthCm) : null,
        tiller_count: review.tillerCount ? Number(review.tillerCount) : null,
        measurement_date: review.measurementDate || null,
        crop_variety: review.cropVariety || null,
        growth_stage: review.growthStage || null,
        sample_count: review.sampleCount ? Number(review.sampleCount) : null,
      },
    };
    optimistic.workflow_stage = optimistic.review_completed_at
      ? 'completed'
      : optimistic.follow_up_at
      ? 'upcoming'
      : optimistic.verification_status === 'Confirmed'
      ? 'confirmed'
      : reportHasReview(optimistic)
      ? 'reviewed'
      : 'needs_review';
    const current = await readPendingReviews(session.user.id);
    const next: PendingReview[] = [
      ...current.filter(item => item.reportId !== selectedReport.id),
      {
        reportId: selectedReport.id,
        review,
        nextStep,
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
      `${selectedReport.code} is queued and will sync when you are back online.${nextStep === 'needed' ? ' Its follow-up visit will be scheduled during sync.' : ''}`,
    );
    showNotice(
      nextStep === 'needed'
        ? 'Review saved on this device. The follow-up visit will be scheduled when you reconnect.'
        : 'Review saved on this device. It will sync when you reconnect.',
      'success',
    );
    return true;
  };

  const submitReview = async (nextStep: 'needed' | 'complete' | null) => {
    if (!session || !selectedReport || !review) return null;
    if (reportIsCompleteWithoutVisit(selectedReport)) {
      showNotice('This report is complete and locked for editing.', 'info');
      return null;
    }
    if (!session.scopes.includes('reports:review')) {
      showNotice(
        'This staff account can view reports but cannot submit reviews.',
        'error',
      );
      return null;
    }
    if (nextStep === null) {
      showNotice('Choose whether this report needs a follow-up visit or is complete.', 'error');
      return null;
    }
    if (nextStep === 'needed' && review.verificationStatus === 'No detection') {
      showNotice('A no-detection decision must complete the report.', 'error');
      return null;
    }
    if (nextStep === 'complete' && review.verificationStatus === 'For verification') {
      showNotice('Choose Confirmed or No detection before completing this report.', 'error');
      return null;
    }
    if (review.verificationStatus === 'Confirmed' && !['Mild', 'Moderate', 'Severe', 'Highly severe'].includes(review.sraSeverity)) {
      showNotice('Choose an SRA-assessed severity for a confirmed report.', 'error');
      return null;
    }
    if (review.verificationStatus === 'No detection' && !review.farmerMessage?.trim()) {
      showNotice('Add a message to the farmer before completing a no-detection report.', 'error');
      return null;
    }
    if (nextStep === 'needed' && !review.followUpAt.trim()) {
      showNotice('Choose a follow-up date before saving this review.', 'error');
      return null;
    }
    const followUpAt = review.followUpAt.trim();
    if (followUpAt && !/^\d{4}-\d{2}-\d{2}$/.test(followUpAt)) {
      showNotice('Enter the follow-up date as YYYY-MM-DD.', 'error');
      return null;
    }
    if (!online) {
      if (!(await queueReviewLocally(nextStep))) return null;
      return nextStep === 'needed' ? 'upcoming' : 'completed';
    }
    setReviewBusy(true);
    try {
      const response = await apiRequest<{ data: FieldReport; visit?: StaffVisit | null }>(
        `/staff/reports/${selectedReport.id}/review`,
        session.token,
        {
          method: 'PUT',
          body: JSON.stringify(reviewPayload(review, nextStep)),
        },
      );
      setSelectedReport(response.data);
      setReports(items =>
        items.map(item =>
          item.id === response.data.id ? response.data : item,
        ),
      );
      mergeReviewVisit(response.visit);
      setReview({
        verificationStatus: response.data.verification_status,
        sraSeverity: response.data.sra_severity || 'Not assessed',
        assessmentRationale: response.data.assessment_rationale || '',
        reviewerNote: response.data.reviewer_note || '',
        farmerMessage: response.data.farmer_message || '',
        followUpAt: response.data.follow_up_at || '',
        plantHeightCm: response.data.sra_crop_assessment?.plant_height_cm?.toString() || '',
        leavesPerStalk: response.data.sra_crop_assessment?.leaves_per_stalk?.toString() || '',
        leafLengthCm: response.data.sra_crop_assessment?.leaf_length_cm?.toString() || '',
        leafWidthCm: response.data.sra_crop_assessment?.leaf_width_cm?.toString() || '',
        tillerCount: response.data.sra_crop_assessment?.tiller_count?.toString() || '',
        measurementDate: response.data.sra_crop_assessment?.measurement_date || '',
        cropVariety: response.data.sra_crop_assessment?.crop_variety || '',
        growthStage: response.data.sra_crop_assessment?.growth_stage || '',
        sampleCount: response.data.sra_crop_assessment?.sample_count?.toString() || '',
      });
      showNotice(
        response.data.follow_up_at
          ? 'Review saved and follow-up visit scheduled.'
          : response.data.review_completed_at
          ? 'Review saved and marked complete.'
          : 'Review saved to the RSSI workspace.',
        'success',
      );
      void refreshData();
      return response.data.follow_up_at
        ? 'visits'
        : response.data.review_completed_at
        ? 'completed'
        : 'reports';
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setOnline(false);
        if (!(await queueReviewLocally(nextStep))) return null;
        return nextStep === 'needed' ? 'upcoming' : 'completed';
      }
      showNotice(
        error instanceof Error ? error.message : 'Review could not be saved.',
        'error',
      );
      return null;
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
          `/staff/reports?page=${nextPage}&pageSize=20`,
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
          `/staff/visits?page=${nextPage}&pageSize=20`,
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
          `/staff/farmers?page=${nextPage}&pageSize=20`,
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
      cropCharacteristics?: CropCharacteristics;
    },
  ): Promise<StaffVisit | null> => {
    if (!session) return null;
    const report = reports.find(item => item.id === reportId);
    if (!report) {
      showNotice('Load the linked report before scheduling its visit offline.', 'error');
      return null;
    }
    const now = new Date().toISOString();
    const localVisit: StaffVisit = {
      id: -(Date.now() * 1000 + Math.floor(Math.random() * 1000)),
      report_id: report.id,
      property_id: report.property_id ?? null,
      report_code: report.code,
      property_name: report.property_name,
      farmer_name: report.farmer?.name || 'Farmer',
      province: report.province,
      municipality: report.municipality,
      scheduled_at: `${values.scheduledAt}T00:00:00+08:00`,
      completed_at: null,
      status: 'scheduled',
      visit_findings: values.visitFindings || null,
      crop_characteristics: values.cropCharacteristics || {
        leavesPerStalk: null,
        plantHeight: null,
        leafLength: null,
        leafWidth: null,
        tillers: null,
        measurementDate: null,
        cropVariety: null,
        growthStage: null,
        sampleCount: null,
      },
      staff_name: session.user.name,
      completed_by_name: null,
      checkings: values.checkings.map((item, index) => ({
        id: -(index + 1),
        label: item.label,
        result: item.result,
        finding: item.finding || null,
      })),
      created_at: now,
      updated_at: now,
      sync_state: 'pending',
    };
    const payload: PendingVisitChange['payload'] = {
      status: 'scheduled',
      scheduledAt: values.scheduledAt,
      visitFindings: values.visitFindings,
      checkings: values.checkings,
      cropCharacteristics: values.cropCharacteristics || {
        leavesPerStalk: null,
        plantHeight: null,
        leafLength: null,
        leafWidth: null,
        tillers: null,
        measurementDate: null,
        cropVariety: null,
        growthStage: null,
        sampleCount: null,
      },
    };
    if (!online || pendingVisitChanges.some(item => item.kind === 'create' && item.reportId === reportId)) {
      const alreadyScheduled = pendingVisitChanges.find(
        item => item.kind === 'create' && item.reportId === reportId,
      );
      if (alreadyScheduled) {
        showNotice('This report already has a visit waiting to sync.', 'info');
        return alreadyScheduled.localVisit;
      }
      const queued = await queueVisitLocally('create', reportId, localVisit, payload, null);
      if (queued) setVisitTotal(total => total + 1);
      return queued;
    }
    if (!session.token) return null;
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
      if (error instanceof ApiError && (error.status === 0 || error.code === 'active_visit_exists')) {
        let remoteVisit: StaffVisit | null = null;
        if (error.code === 'active_visit_exists' && session.token) {
          try {
            const current = await apiRequest<ApiPage<StaffVisit>>(
              '/staff/visits?status=scheduled&page=1&pageSize=50',
              session.token,
            );
            remoteVisit = current.data.find(item => item.report_id === reportId) || null;
          } catch {
            // Keep the local plan available even if the conflict lookup fails.
          }
        }
        const queued = await queueVisitLocally(
          'create',
          reportId,
          localVisit,
          payload,
          null,
          error.code === 'active_visit_exists'
            ? { message: 'A scheduled visit already exists for this report.', remoteVisit }
            : undefined,
        );
        if (queued) setVisitTotal(total => total + 1);
        return queued;
      }
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
      cropCharacteristics: CropCharacteristics;
    },
  ): Promise<StaffVisit | null> => {
    if (!session) return null;
    const visit = visits.find(item => item.id === visitId);
    if (!visit) {
      showNotice('This visit is not loaded on this device. Refresh while online before editing it.', 'error');
      return null;
    }
    const existingChange = pendingVisitChanges.find(item =>
      visitId < 0 ? item.localVisit.id === visitId : item.visitId === visitId,
    );
    const payload: PendingVisitChange['payload'] = {
      ...values,
      checkings: values.checkings.map(item => ({ ...item })),
    };
    const now = new Date().toISOString();
    const localVisit: StaffVisit = {
      ...visit,
      scheduled_at: `${values.scheduledAt}T00:00:00+08:00`,
      completed_at: values.status === 'completed' ? now : null,
      status: values.status,
      visit_findings: values.visitFindings || null,
      crop_characteristics: values.cropCharacteristics,
      completed_by_name: values.status === 'completed' ? session.user.name : null,
      checkings: values.checkings.map((item, index) => ({
        id: visit.checkings[index]?.id ?? -(index + 1),
        label: item.label,
        result: item.result,
        finding: item.finding || null,
      })),
      updated_at: now,
      sync_state: 'pending',
    };
    if (!online || existingChange || visitId < 0) {
      return queueVisitLocally(
        existingChange?.kind || 'update',
        visit.report_id,
        localVisit,
        payload,
        existingChange?.expectedUpdatedAt ?? (visitId > 0 ? visit.updated_at : null),
        undefined,
        existingChange?.baseVisit ?? visit,
      );
    }
    if (!session.token) return null;
    setVisitBusy(true);
    try {
      const response = await apiRequest<{ data: StaffVisit }>(
        `/staff/visits/${visitId}`,
        session.token,
        {
          method: 'PUT',
          body: JSON.stringify({
            ...visitPayloadForApi(values),
            expectedUpdatedAt: visit.updated_at,
          }),
        },
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
      if (error instanceof ApiError && (error.status === 0 || error.code === 'visit_conflict')) {
        const remoteVisit = error.payload?.data as StaffVisit | undefined;
        return queueVisitLocally(
          'update',
          visit.report_id,
          localVisit,
          payload,
          visit.updated_at,
          error.code === 'visit_conflict'
            ? { message: error.message, remoteVisit: remoteVisit || null }
            : undefined,
          visit,
        );
      }
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
              !reportIsCompleteWithoutVisit(report) &&
              report.verification_status !== 'Confirmed'
            : listFilter === 'Needs review' || listFilter === 'For verification'
            ? reportWorkflowStage(report) === 'needs_review'
            : listFilter === 'Upcoming'
            ? !reportIsCompleteWithoutVisit(report) && Boolean(report.follow_up_at)
            : listFilter === 'Completed'
            ? reportIsCompleteWithoutVisit(report)
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
