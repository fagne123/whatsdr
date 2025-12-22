import { createContext, useContext, useReducer, useEffect } from 'react';
import wsService from '../services/websocket';
import { getActiveCalls } from '../services/api';
import { useAuth } from './AuthContext';

const CallsContext = createContext(null);

const initialState = {
  activeCalls: [],
  loading: false,
  error: null
};

function callsReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_CALLS':
      return { ...state, activeCalls: action.payload, loading: false };
    case 'ADD_CALL':
      return { ...state, activeCalls: [...state.activeCalls, action.payload] };
    case 'UPDATE_CALL':
      return {
        ...state,
        activeCalls: state.activeCalls.map(call =>
          call.id === action.payload.id ? { ...call, ...action.payload } : call
        )
      };
    case 'REMOVE_CALL':
      return {
        ...state,
        activeCalls: state.activeCalls.filter(call => call.id !== action.payload)
      };
    case 'ADD_TRANSCRIPT':
      return {
        ...state,
        activeCalls: state.activeCalls.map(call =>
          call.id === action.payload.callId
            ? { ...call, transcripts: [...(call.transcripts || []), action.payload] }
            : call
        )
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
}

export function CallsProvider({ children }) {
  const [state, dispatch] = useReducer(callsReducer, initialState);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Carrega chamadas ativas inicialmente
    loadActiveCalls();

    // Escuta eventos WebSocket
    const handleCallStarted = (data) => {
      dispatch({ type: 'ADD_CALL', payload: data.call });
    };

    const handleCallEnded = (data) => {
      dispatch({ type: 'REMOVE_CALL', payload: data.callId });
    };

    const handleTranscript = (data) => {
      dispatch({ type: 'ADD_TRANSCRIPT', payload: data });
    };

    const handleCallStatus = (data) => {
      dispatch({ type: 'UPDATE_CALL', payload: data });
    };

    wsService.on('call:started', handleCallStarted);
    wsService.on('call:ended', handleCallEnded);
    wsService.on('call:transcript', handleTranscript);
    wsService.on('call:status', handleCallStatus);

    return () => {
      wsService.off('call:started', handleCallStarted);
      wsService.off('call:ended', handleCallEnded);
      wsService.off('call:transcript', handleTranscript);
      wsService.off('call:status', handleCallStatus);
    };
  }, [user]);

  const loadActiveCalls = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const data = await getActiveCalls();
      dispatch({ type: 'SET_CALLS', payload: data.calls || [] });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  };

  return (
    <CallsContext.Provider value={{ ...state, dispatch, loadActiveCalls }}>
      {children}
    </CallsContext.Provider>
  );
}

export function useCalls() {
  const context = useContext(CallsContext);
  if (!context) {
    throw new Error('useCalls must be used within a CallsProvider');
  }
  return context;
}
