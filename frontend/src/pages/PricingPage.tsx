import React, { useState } from 'react';
import {
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  Film,
  Image as ImageIcon,
  HelpCircle,
} from 'lucide-react';
import { PricingPlan, UserProfile } from '../types';
import { api } from '../services/api';

interface PricingProps {
  plans: PricingPlan[];
  user: UserProfile | null;
  onUserUpdate: (updatedUser: UserProfile) => void;
}

export const PricingPage: React.FC<PricingProps> = ({
  plans,
  user,
  onUserUpdate,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const handleSelectPlan = async (planName: string) => {
    setIsUpdating(planName);
    try {
      // Map UI plan name to backend tier
      const tier = planName.includes('Free')
        ? 'Free'
        : planName.includes('Pro')
        ? 'Pro'
        : 'Enterprise';
      const updated = await api.upgradePlan(tier);
      onUserUpdate(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center">
      {/* Top Banner */}
      <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300 shadow-lg shadow-purple-500/10 mb-4 backdrop-blur-md">
        <Zap className="h-3.5 w-3.5 text-purple-400 fill-purple-400" />
        <span>Flexible Plans for Creators & Production Studios</span>
      </div>

      <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
        Transparent Pricing.{' '}
        <span className="gradient-text">Zero Compromises.</span>
      </h1>
      <p className="mt-4 text-sm text-slate-400 max-w-xl mx-auto">
        Choose the plan that fits your production workload. Upgrade, downgrade, or cancel anytime with instant credit allocation.
      </p>

      {/* Monthly / Annual Toggle */}
      <div className="mt-8 inline-flex items-center rounded-full border border-white/10 bg-[#12141e] p-1.5 shadow-inner">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={`rounded-full px-5 py-2 text-xs font-semibold transition-all ${
            billingCycle === 'monthly'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Monthly Billing
        </button>
        <button
          onClick={() => setBillingCycle('annual')}
          className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold transition-all ${
            billingCycle === 'annual'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Annual Billing</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">
            Save 20%
          </span>
        </button>
      </div>

      {/* Pricing Cards Grid */}
      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
        {plans.map((plan) => {
          const isCurrentPlan = user?.plan?.toLowerCase() === plan.id.toLowerCase();
          const price =
            billingCycle === 'annual'
              ? Math.round(plan.price_monthly * 0.8)
              : plan.price_monthly;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-3xl p-8 backdrop-blur-xl transition-all ${
                plan.is_popular
                  ? 'border-2 border-purple-500 bg-gradient-to-b from-purple-950/40 via-[#12141e] to-[#0d0f17] shadow-2xl shadow-purple-500/20 scale-105 z-10'
                  : 'border border-white/10 bg-[#12141e]/80 hover:border-white/20'
              }`}
            >
              {plan.is_popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1 text-[11px] font-bold text-white shadow-md">
                  Most Popular for Creators
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {plan.id === 'free'
                    ? 'Perfect for personal tests and occasional cleanups'
                    : plan.id === 'pro'
                    ? 'High performance temporal inpainting for creators'
                    : 'Unlimited batch restoration for creative teams'}
                </p>

                {/* Price Display */}
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">${price}</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-xs text-purple-300">
                  <Zap className="h-4 w-4 text-purple-400 fill-purple-400 shrink-0" />
                  <span>
                    <strong>{plan.credits} credits</strong> renewed monthly
                  </span>
                </div>

                {/* Features List */}
                <ul className="mt-6 space-y-3 text-xs text-slate-300">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 mt-0.5">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-4 border-t border-white/5">
                <button
                  disabled={isCurrentPlan || isUpdating === plan.name}
                  onClick={() => handleSelectPlan(plan.name)}
                  className={`w-full rounded-2xl py-3 text-xs font-bold transition-all ${
                    isCurrentPlan
                      ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 cursor-default'
                      : plan.is_popular
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:scale-105 active:scale-95'
                      : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {isUpdating === plan.name
                    ? 'Updating...'
                    : isCurrentPlan
                    ? 'Current Active Plan'
                    : `Switch to ${plan.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ Accordion */}
      <div className="mt-24 max-w-3xl mx-auto text-left">
        <h3 className="text-xl font-bold text-white text-center mb-8">Frequently Asked Questions</h3>
        <div className="space-y-4">
          {[
            {
              q: 'How do credits work in CleanFrame AI?',
              a: '1 credit is consumed for every image restoration. Video inpainting consumes 2 credits per 10 seconds of processed video. Unused credits rollover on Pro & Enterprise plans.',
            },
            {
              q: 'How does CleanFrame inpaint instead of blur?',
              a: 'Our engine uses multi-stage Fast Marching & Navier-Stokes partial differential equations combined with Poisson gradient blending. For video, temporal optical flow transfers real uncovered background pixels from adjacent frames.',
            },
            {
              q: 'Is my media securely handled?',
              a: 'Yes. All uploads are processed strictly in memory and temporary sandboxes. Files are automatically scheduled for deletion and never stored permanently without your consent.',
            },
            {
              q: 'Can I remove watermarks from unauthorized content?',
              a: 'No. CleanFrame AI is strictly licensed for creators editing their own media or content they have explicit legal rights to modify.',
            },
          ].map((faq, idx) => (
            <div key={idx} className="rounded-2xl border border-white/5 bg-[#12141e]/60 p-5">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-purple-400" />
                <span>{faq.q}</span>
              </h4>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed pl-6">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
