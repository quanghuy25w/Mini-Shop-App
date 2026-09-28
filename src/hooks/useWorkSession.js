import { useContext } from 'react';
import { WorkSessionContext } from '../context/WorkSessionContext';

export const useWorkSession = () => {
  const context = useContext(WorkSessionContext);
  if (!context) {
    return {
      currentSession: null,
      currentMember: null,
      activeSessions: [],
      isCheckedIn: false,
      workingStatus: 'offline',
      loading: false,
      checkIn: async () => ({ success: false }),
      checkInSession: async () => ({ success: false }),
      checkOut: async () => ({ success: false }),
      updateWorkingStatus: async () => {},
      refreshSessions: async () => {}
    };
  }
  return context;
};
