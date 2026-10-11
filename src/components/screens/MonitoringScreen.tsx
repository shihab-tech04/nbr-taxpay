import React from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Server, 
  ShieldCheck, 
  Radio,
  ArrowRight
} from 'lucide-react';
import { useTaxState } from '../../services/taxState';

export const MonitoringScreen: React.FC = () => {
  const { gatewayHealth } = useTaxState();

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 mb-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif-fraunces text-2xl font-bold text-slate-900">
              Payment Gateway SLA & Infrastructure Health Monitoring
            </h1>
            <p className="text-xs text-slate-500">
              Live telemetry and latency indicators for all interconnected commercial banks, MFS aggregators, and the central Treasury switch.
            </p>
          </div>
        </div>

        {/* Global SLA Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Overall Network Uptime:</span>
            <span className="font-mono-plex font-bold text-xl text-emerald-800 mt-1 block">99.89%</span>
            <span className="text-[10px] text-slate-400">Past 30 Rolling Days</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Average Response Latency:</span>
            <span className="font-mono-plex font-bold text-xl text-slate-900 mt-1 block">312 ms</span>
            <span className="text-[10px] text-emerald-700">Within Optimal SLA</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Active Gateways:</span>
            <span className="font-mono-plex font-bold text-xl text-emerald-900 mt-1 block">6 Systems</span>
            <span className="text-[10px] text-slate-400">All Connected</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Real-Time Incidents:</span>
            <span className="font-mono-plex font-bold text-xl text-amber-700 mt-1 block">3 Active</span>
            <span className="text-[10px] text-amber-800">Under Investigation</span>
          </div>
        </div>

        {/* Individual Gateway Health Rows */}
        <div className="space-y-3">
          {gatewayHealth.map(gw => (
            <div key={gw.id} className="p-4 rounded-xl border border-slate-200 bg-white text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${gw.status === 'OPTIMAL' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <h3 className="font-bold text-sm text-slate-900">{gw.gatewayName}</h3>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
                  <span>Latency: <strong className="text-slate-700">{gw.avgLatencyMs} ms</strong></span>
                  <span>24h Success Rate: <strong className="text-emerald-800">{gw.successRate24h}%</strong></span>
                  <span>Uptime: {gw.uptime24h}%</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                  gw.status === 'OPTIMAL' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {gw.status}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Heartbeat: {gw.lastHeartbeat}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
