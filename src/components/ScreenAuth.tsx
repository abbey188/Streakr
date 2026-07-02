import React, { useState } from "react";
import { Team } from "../types";
import CountryFlag from "./CountryFlag";
import { motion } from "motion/react";
import { ArrowLeft, Mail, ArrowRight, Flame, Sparkles } from "lucide-react";
import { useIdentity } from "@/lib/identity/context";

interface ScreenAuthProps {
  temporaryPick: Team | null;
  onBack?: () => void;
}

// Apple OAuth needs your own Apple Developer credentials in the Privy Dashboard
// (Client ID + signing key + Key/Team ID) and can take weeks to approve. Until
// that's set, the button stays visible but disabled. Flip the env to enable.
const APPLE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_APPLE_LOGIN === "true";

export default function ScreenAuth({ temporaryPick, onBack }: ScreenAuthProps) {
  const {
    signInWithOAuth,
    sendEmailCode,
    verifyEmailCode,
    emailOtpStage,
    oauthLoading,
  } = useIdentity();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [authError, setAuthError] = useState("");

  // Real auth completion (Privy) flips isAuthenticated; App.tsx reacts and
  // routes onward — this screen only kicks off the chosen method.
  const isSending = emailOtpStage === "sending";
  const isVerifying = emailOtpStage === "verifying";
  const awaitingCode = emailOtpStage === "awaiting-code" || isVerifying;

  const handleOAuth = async (provider: "google" | "apple") => {
    setAuthError("");
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
    }
  };

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (!awaitingCode) {
        if (!email.trim()) return;
        await sendEmailCode(email.trim());
      } else {
        if (!code.trim()) return;
        await verifyEmailCode(code.trim());
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#0A0E1A] text-white font-sans pb-10 relative">
      {/* Background radial highlight */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row — back button only shown when a handler is provided */}
      <div className="flex items-center justify-between px-4 pt-4 z-10 max-w-7xl mx-auto w-full">
        {onBack ? (
          <button
            onClick={onBack}
            className="p-1.5 bg-[#2D364F]/50 hover:bg-[#2D364F] rounded-full border border-white/5 text-slate-300 hover:text-white transition cursor-pointer"
            id="auth-back-button"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-8" />
        )}
        <div className="w-8" /> {/* Spacer to balance the header */}
      </div>

      {/* Centered Fire Logo Badge (matching the landing screen style) */}
      <div className="flex flex-col items-center justify-center mt-6 mb-4 z-10">
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-[20px] sm:rounded-[24px] border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_#000000,0_15px_30px_rgba(255,78,0,0.25)] relative"
        >
          {/* Inner Red Flame badge backdrop */}
          <div className="w-11 h-11 sm:w-14 sm:h-14 bg-[#FF4E00] rounded-[15px] sm:rounded-[18px] flex items-center justify-center">
            <Flame className="w-6.5 h-6.5 sm:w-8 sm:h-8 text-white fill-white animate-pulse" />
          </div>

          {/* Sparkle badge decorator */}
          <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-black border-2 border-black p-0.5 rounded-lg shadow-sm">
            <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5 fill-current" />
          </span>
        </motion.div>
      </div>

      {/* Main Content Area — top-aligned on mobile so the logo sits close to the
          heading (centering pushed it far above the text); centered on desktop. */}
      <div className="flex-grow flex flex-col justify-start lg:justify-center max-w-7xl mx-auto w-full z-10 px-4 pt-1 pb-6 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Visual stake / promo summary */}
          <div className="lg:col-span-5 text-center lg:text-left space-y-5 lg:space-y-6">
            <div>
              <h2 className="text-2xl lg:text-4xl font-black italic tracking-tighter text-white leading-tight uppercase">
                Sign In To Start Your <span className="text-[#FF4E00] block mt-0.5 lg:inline">Streak</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#8E9299] mt-3 leading-relaxed max-w-md mx-auto lg:mx-0">
                Make your picks, win, climb the leaderboard, compete with friends in groups, and share your streak.
              </p>
            </div>

            {/* Dynamic Stake Banner */}
            {temporaryPick && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[#FF4E00]/10 border border-[#FF4E00]/20 rounded-2xl p-3.5 flex items-center justify-between shadow-lg max-w-md mx-auto lg:mx-0"
              >
                <div className="flex items-center gap-3">
                  <CountryFlag name={temporaryPick.name} className="w-8 h-6" width={80} />
                  <div className="text-left">
                    <span className="text-[8px] font-mono text-[#FF4E00] font-bold uppercase tracking-wider block">
                      Pending Choice
                    </span>
                    <span className="text-xs font-black italic text-white">
                      {temporaryPick.name} to Win
                    </span>
                  </div>
                </div>
                <span className="bg-[#FF4E00] text-white font-black italic text-[8px] px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                  Locked In
                </span>
              </motion.div>
            )}
          </div>

          {/* Right Column: Interaction inputs & buttons */}
          <div className="lg:col-span-7 bg-[#151B2E] border border-white/5 rounded-[24px] p-5 sm:p-8 lg:p-10 shadow-2xl space-y-5 max-w-md mx-auto lg:max-w-xl w-full">
            
            {/* Auth Buttons */}
            <div className="space-y-3">
              {/* Shared error banner (covers OAuth + email). The in-form copy
                  is shown only for the email step; this one catches OAuth too. */}
              {authError && !showEmailInput && (
                <p className="text-[10px] font-bold text-red-400 leading-snug text-center">{authError}</p>
              )}
              {/* Google Button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleOAuth("google")}
                disabled={oauthLoading}
                className="w-full bg-white hover:bg-slate-100 text-slate-900 font-black italic text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 cursor-pointer shadow-lg transition-all disabled:opacity-60"
                id="auth-google-btn"
              >
                {/* Google Vector Icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.23-.66-.35-1.36-.35-2.09z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                Continue with Google
              </motion.button>

              {/* Apple Button — disabled until Apple OAuth credentials are set */}
              <motion.button
                whileTap={APPLE_ENABLED ? { scale: 0.98 } : undefined}
                onClick={() => APPLE_ENABLED && handleOAuth("apple")}
                disabled={!APPLE_ENABLED || oauthLoading}
                title={APPLE_ENABLED ? undefined : "Apple sign-in coming soon"}
                className="w-full bg-[#2D364F]/30 hover:bg-[#2D364F]/50 text-white border border-white/5 font-black italic text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                id="auth-apple-btn"
              >
                {/* Apple Vector Icon */}
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.52-.64.74-1.2 1.88-1.05 3 .1.01 2.33-.65 3-1.46" />
                </svg>
                {APPLE_ENABLED ? "Continue with Apple" : "Apple — coming soon"}
              </motion.button>

              {/* Email Dropdown Toggle */}
              {!showEmailInput ? (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEmailInput(true)}
                  className="w-full bg-[#2D364F]/50 hover:bg-[#2D364F]/75 text-slate-300 border border-white/5 font-bold uppercase tracking-wider text-[10px] py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                  id="auth-email-toggle"
                >
                  <Mail className="w-4 h-4 text-[#8E9299]" />
                  Use email address instead
                </motion.button>
              ) : (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  onSubmit={handleSubmitEmail}
                  className="bg-[#0A0E1A] border border-white/10 rounded-2xl p-4 space-y-3 shadow-inner w-full"
                >
                  {!awaitingCode ? (
                    /* Step 1 — email entry */
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-mono uppercase tracking-wider text-[#8E9299] font-bold">
                        Enter Your Email
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full bg-[#151B2E] border border-white/5 focus:border-[#FF4E00] rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Step 2 — verification code entry */
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-mono uppercase tracking-wider text-[#8E9299] font-bold">
                        Enter the 6-digit code sent to {email}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          required
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder="123456"
                          className="w-full bg-[#151B2E] border border-white/5 focus:border-[#FF4E00] rounded-xl px-3 py-2.5 text-sm tracking-[0.3em] text-center text-white placeholder-slate-600 outline-none transition"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => { setCode(""); setAuthError(""); setShowEmailInput(true); }}
                        className="text-[9px] font-mono text-[#8E9299] hover:text-slate-300 transition self-start mt-0.5"
                      >
                        ← Use a different email
                      </button>
                    </div>
                  )}

                  {authError && (
                    <p className="text-[10px] font-bold text-red-400 leading-snug">{authError}</p>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={isSending || isVerifying}
                    className="w-full bg-[#FF4E00] hover:bg-orange-600 text-white font-black italic text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow transition-all disabled:opacity-60"
                    id="auth-email-submit"
                  >
                    {isSending
                      ? "Sending code..."
                      : isVerifying
                      ? "Verifying..."
                      : awaitingCode
                      ? "Verify & Connect"
                      : "Send Login Code"}
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </motion.form>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
