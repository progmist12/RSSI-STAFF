import React from 'react';
import { StaffAppView } from './app/StaffAppView';
import { useStaffAppController } from './app/useStaffAppController';

export default function StaffApp() {
  const app = useStaffAppController();
  return <StaffAppView app={app} />;
}
