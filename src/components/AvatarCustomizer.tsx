import React, { useState, useEffect } from "react";
import AvatarRenderer, { SKIN_TONES, KITS, EXPRESSIONS_MAP } from "./AvatarRenderer";
import CountryFlag from "./CountryFlag";
import { AvatarConfig } from "../types";
import { motion } from "motion/react";
import {
  Check, AlertCircle, RefreshCw, Sparkles, User, Smile, Paintbrush, Crown, Hash, PenTool, Flag,
} from "lucide-react";

/**
 * Shared mascot customizer — the single source of truth for building/editing an
 * AvatarConfig. Used by BOTH the create-fan-identity flow (ScreenIdentity) and
 * the Profile "edit mascot" modal, so the two can never drift apart and the
 * full set of options (expression, kit, skin, jersey number, headgear) is always
 * available — and never silently dropped on save.
 *
 * Layout: responsive two-column (live preview + controls) that fills desktop
 * width and tightens to a single column on mobile.
 */

const PRESET_USERNAMES = [
  "StreakKing07", "FullTime42", "Chidi_Goal", "SarahKicks", "GoalDigger",
  "TikiTakaMax", "OffsideHero", "CleanSheet99", "InjuryTime88", "VolleyPro",
  "TopBinz", "FalseNine", "GoldenBoot", "SupaStriker", "PanenkaKing",
];

const HEADGEAR_OPTIONS = [
  { id: "none", label: "None" },
  { id: "cap", label: "Snapback" },
  { id: "crown", label: "Crown" },
  { id: "bandana", label: "Bandana" },
  { id: "beanie", label: "Beanie" },
  { id: "headphones", label: "Headset" },
];

// Self-declared "backing nation" — who you're riding with this World Cup.
// Not location tracking; purely a fun identity pick shown on leaderboards.
const NATIONS = [
  { flag: "🇦🇷", name: "Argentina" }, { flag: "🇧🇷", name: "Brazil" }, { flag: "🇫🇷", name: "France" },
  { flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "England" }, { flag: "🇪🇸", name: "Spain" }, { flag: "🇩🇪", name: "Germany" },
  { flag: "🇵🇹", name: "Portugal" }, { flag: "🇳🇱", name: "Netherlands" }, { flag: "🇧🇪", name: "Belgium" },
  { flag: "🇮🇹", name: "Italy" }, { flag: "🇭🇷", name: "Croatia" }, { flag: "🇺🇾", name: "Uruguay" },
  { flag: "🇲🇽", name: "Mexico" }, { flag: "🇺🇸", name: "USA" }, { flag: "🇨🇦", name: "Canada" },
  { flag: "🇯🇵", name: "Japan" }, { flag: "🇰🇷", name: "South Korea" }, { flag: "🇲🇦", name: "Morocco" },
  { flag: "🇸🇳", name: "Senegal" }, { flag: "🇳🇬", name: "Nigeria" }, { flag: "🇬🇭", name: "Ghana" },
  { flag: "🇨🇲", name: "Cameroon" }, { flag: "🇪🇬", name: "Egypt" }, { flag: "🇩🇿", name: "Algeria" },
  { flag: "🇨🇮", name: "Ivory Coast" }, { flag: "🇨🇱", name: "Chile" }, { flag: "🇨🇴", name: "Colombia" },
  { flag: "🇵🇪", name: "Peru" }, { flag: "🇪🇨", name: "Ecuador" }, { flag: "🇷🇸", name: "Serbia" },
  { flag: "🇨🇭", name: "Switzerland" }, { flag: "🇩🇰", name: "Denmark" }, { flag: "🇵🇱", name: "Poland" },
  { flag: "🇸🇪", name: "Sweden" }, { flag: "🇹🇷", name: "Turkey" }, { flag: "🇦🇺", name: "Australia" },
  { flag: "🇸🇦", name: "Saudi Arabia" }, { flag: "🇶🇦", name: "Qatar" }, { flag: "🇮🇷", name: "Iran" },
  { flag: "🇺🇦", name: "Ukraine" },
];

type Tab = "expression" | "kit" | "skin" | "number" | "headgear" | "nation";

interface AvatarCustomizerProps {
  /** Seed values — pass the existing avatar when editing; omit when creating. */
  initialConfig?: Partial<AvatarConfig>;
  /** Label for the primary action (e.g. "Lock In Fan Identity" / "Confirm Changes"). */
  confirmLabel: string;
  onConfirm: (config: AvatarConfig) => void;
}

export default function AvatarCustomizer({
  initialConfig,
  confirmLabel,
  onConfirm,
}: AvatarCustomizerProps) {
  const [username, setUsername] = useState(initialConfig?.username ?? "");
  const [selectedSkin, setSelectedSkin] = useState(initialConfig?.skinTone ?? SKIN_TONES[1].color);
  const [selectedKit, setSelectedKit] = useState(
    KITS.find((k) => k.primary === initialConfig?.kitPrimary) ?? KITS[0]
  );
  const [selectedExpression, setSelectedExpression] = useState(initialConfig?.expression ?? "happy");
  const [selectedJerseyNumber, setSelectedJerseyNumber] = useState(
    initialConfig?.jerseyNumber ?? String(Math.floor(Math.random() * 99) + 1)
  );
  const [selectedHeadgear, setSelectedHeadgear] = useState(initialConfig?.headgear ?? "none");
  const [selectedNation, setSelectedNation] = useState(initialConfig?.nation ?? "");

  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [isUsernameValid, setIsUsernameValid] = useState<boolean | null>(null);
  const [validationMsg, setValidationMsg] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("expression");

  const generateSuggestions = () => {
    const shuffled = [...PRESET_USERNAMES].sort(() => 0.5 - Math.random());
    setUsernameSuggestions(shuffled.slice(0, 3));
  };

  useEffect(() => {
    generateSuggestions();
  }, []);

  // Validate username on type.
  useEffect(() => {
    if (!username) {
      setIsUsernameValid(null);
      setValidationMsg("");
      return;
    }
    if (username.length < 3) {
      setIsUsernameValid(false);
      setValidationMsg("Must be at least 3 characters");
    } else if (username.length > 15) {
      setIsUsernameValid(false);
      setValidationMsg("Too long (max 15)");
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setIsUsernameValid(false);
      setValidationMsg("Alphanumeric & underscores only");
    } else {
      setIsUsernameValid(true);
      setValidationMsg("Username available!");
    }
  }, [username]);

  const handleConfirm = () => {
    const finalUsername =
      username.trim() || PRESET_USERNAMES[Math.floor(Math.random() * PRESET_USERNAMES.length)];
    onConfirm({
      username: finalUsername,
      skinTone: selectedSkin,
      kitPrimary: selectedKit.primary,
      kitSecondary: selectedKit.secondary,
      expression: selectedExpression,
      jerseyNumber: selectedJerseyNumber,
      headgear: selectedHeadgear,
      nation: selectedNation || undefined,
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-start">

        {/* Left Column: Live Mascot Preview */}
        <div className="lg:col-span-5 bg-[#151B2E] border border-white/5 rounded-[28px] p-5 lg:p-6 flex flex-col items-center text-center shadow-2xl relative overflow-hidden w-full lg:sticky lg:top-2">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#FF4E00]/5 rounded-full blur-2xl pointer-events-none" />

          <span className="text-[9px] font-mono text-[#FF4E00] font-bold uppercase tracking-widest bg-[#FF4E00]/10 border border-[#FF4E00]/25 px-3 py-1 rounded-full mb-4 flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,78,0,0.08)]">
            <Sparkles className="w-3.5 h-3.5 text-[#FF4E00] fill-[#FF4E00]" /> Live Mascot Preview
          </span>

          <div className="bg-[#0A0E1A] border border-white/5 p-6 rounded-[28px] flex items-center justify-center relative overflow-hidden shadow-inner w-40 h-48 lg:w-52 lg:h-60">
            <div className="absolute inset-0 bg-gradient-to-t from-[#151B2E] via-transparent to-transparent opacity-80" />
            <div className="scale-100 lg:scale-110 transform transition-transform duration-300">
              <AvatarRenderer
                skinTone={selectedSkin}
                kitPrimary={selectedKit.primary}
                kitSecondary={selectedKit.secondary}
                expression={selectedExpression}
                jerseyNumber={selectedJerseyNumber}
                headgear={selectedHeadgear}
                size="lg"
                isAnimated={true}
              />
            </div>
          </div>

          <h3 className="text-lg font-black italic text-white mt-4 uppercase tracking-tight flex items-center justify-center gap-1.5">
            {selectedNation && <CountryFlag name={selectedNation} className="w-6 h-4" width={80} />}
            @{username || "Your_Mascot"}
          </h3>
        </div>

        {/* Right Column: Username + Customization Knobs */}
        <div className="lg:col-span-7 bg-[#151B2E] border border-white/5 rounded-[28px] p-5 lg:p-7 shadow-2xl space-y-5 w-full">

          {/* Username block */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-[#8E9299] font-black uppercase tracking-wider flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-[#FF4E00]" /> Claim Your Unique Username
            </label>

            <input
              type="text"
              placeholder="Type your username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full bg-[#0A0E1A] border text-xs font-black italic rounded-xl px-3.5 py-3 outline-none transition ${
                isUsernameValid === true
                  ? "border-emerald-500 text-emerald-400"
                  : isUsernameValid === false
                  ? "border-red-500 text-red-400"
                  : "border-white/5 focus:border-[#FF4E00] text-white"
              }`}
              id="customizer-username-input"
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-0.5">
              {username ? (
                <p
                  className={`text-[10px] font-bold flex items-center gap-1 leading-none ${
                    isUsernameValid === true ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {isUsernameValid === true ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )}
                  {validationMsg}
                </p>
              ) : (
                <span className="text-[9px] font-mono text-[#8E9299]">Or choose from suggested options:</span>
              )}

              <div className="flex flex-wrap gap-1.5 items-center">
                {usernameSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setUsername(s)}
                    className="bg-[#2D364F]/30 hover:bg-[#2D364F]/60 text-[10px] text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-white/5 transition cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
                <button
                  onClick={generateSuggestions}
                  title="Get new suggestions"
                  className="p-1.5 bg-[#2D364F]/30 border border-white/5 rounded-lg text-[#8E9299] hover:text-white transition hover:bg-[#2D364F] cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Customization tabs */}
          <div className="space-y-3 pt-1">
            <label className="text-[10px] font-mono text-[#8E9299] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Paintbrush className="w-3.5 h-3.5 text-[#FF4E00]" /> Customize Fan Outfit & Expression
            </label>

            <div className="flex items-center gap-1 bg-[#0A0E1A] p-1.5 rounded-xl border border-white/5 overflow-x-auto no-scrollbar scroll-smooth">
              {([
                { id: "expression", label: "Face", Icon: Smile },
                { id: "kit", label: "Kit", Icon: Paintbrush },
                { id: "skin", label: "Skin Tone", Icon: User },
                { id: "number", label: "Number", Icon: Hash },
                { id: "headgear", label: "Headwear", Icon: Crown },
                { id: "nation", label: "Nation", Icon: Flag },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-3.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 flex-shrink-0 cursor-pointer transition ${
                    activeTab === id ? "bg-[#FF4E00] text-white shadow" : "text-[#8E9299] hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Tab panels */}
            <div className="bg-[#0A0E1A]/45 border border-white/5 p-4 rounded-2xl overflow-y-auto max-h-[220px]">
              {activeTab === "expression" && (
                <div className="grid grid-cols-4 gap-2">
                  {Object.keys(EXPRESSIONS_MAP).map((expKey) => {
                    const isActive = selectedExpression === expKey;
                    return (
                      <button
                        key={expKey}
                        onClick={() => setSelectedExpression(expKey)}
                        className={`relative aspect-square bg-[#0A0E1A] border-2 rounded-xl flex flex-col items-center justify-center p-1.5 transition-all cursor-pointer ${
                          isActive ? "border-[#FF4E00] scale-105" : "border-white/5 hover:border-white/20"
                        }`}
                      >
                        <svg viewBox="0 0 50 50" className="w-10 h-10 text-slate-900">
                          <rect x="2" y="2" width="46" height="46" rx="8" fill={selectedSkin} stroke="#1E1B4B" strokeWidth="2" />
                          <g transform="translate(1, 3)">{EXPRESSIONS_MAP[expKey].render()}</g>
                        </svg>
                        <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-tight text-center leading-none mt-1">
                          {EXPRESSIONS_MAP[expKey].label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === "kit" && (
                <div className="grid grid-cols-2 gap-2">
                  {KITS.map((kit) => {
                    const isActive = selectedKit.id === kit.id;
                    return (
                      <button
                        key={kit.id}
                        onClick={() => setSelectedKit(kit)}
                        className={`p-2 bg-[#0A0E1A] border-2 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer text-left ${
                          isActive ? "border-[#FF4E00] scale-[1.02]" : "border-white/5 hover:border-white/20"
                        }`}
                      >
                        <div className="relative w-7 h-7 rounded-lg flex-shrink-0 overflow-hidden border border-white/10">
                          <div className="absolute inset-0" style={{ backgroundColor: kit.primary }} />
                          <div className="absolute top-0 right-0 w-3 h-8 rotate-12 bg-white/20" />
                          <div className="absolute top-0 bottom-0 left-1/3 w-2" style={{ backgroundColor: kit.secondary }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[8px] min-[360px]:text-[8.5px] sm:text-[9.5px] font-black italic tracking-tight text-white leading-tight">
                            {kit.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === "skin" && (
                <div className="grid grid-cols-3 gap-2">
                  {SKIN_TONES.map((tone) => {
                    const isActive = selectedSkin === tone.color;
                    return (
                      <button
                        key={tone.id}
                        onClick={() => setSelectedSkin(tone.color)}
                        className={`p-2.5 bg-[#0A0E1A] border-2 rounded-xl flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          isActive ? "border-[#FF4E00] scale-105" : "border-white/5 hover:border-white/20"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full border border-white/20" style={{ backgroundColor: tone.color }} />
                        <span className="text-[7.5px] min-[360px]:text-[8px] sm:text-[8.5px] font-bold text-slate-400 text-center leading-tight">
                          {tone.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === "number" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-[#0A0E1A]/80 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[9px] font-mono text-[#8E9299] uppercase tracking-wider font-bold">Custom No:</span>
                    <input
                      type="text"
                      maxLength={2}
                      value={selectedJerseyNumber === "none" ? "" : selectedJerseyNumber}
                      placeholder="--"
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setSelectedJerseyNumber(val || "none");
                      }}
                      className="w-12 bg-[#0A0E1A] border border-white/10 text-center rounded-lg py-1 text-xs font-black text-[#FF4E00] outline-none focus:border-[#FF4E00]"
                    />
                    <span className="text-[8px] text-[#8E9299] font-mono leading-tight">Type (0-99) or tap presets:</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {["7", "10", "8", "9", "11", "14", "23", "99", "none"].map((num) => {
                      const isActive = selectedJerseyNumber === num;
                      return (
                        <button
                          key={num}
                          onClick={() => setSelectedJerseyNumber(num)}
                          className={`py-1.5 text-[9px] font-black italic rounded-lg transition border cursor-pointer ${
                            isActive
                              ? "bg-[#FF4E00] border-[#FF4E00] text-white"
                              : "bg-[#0A0E1A] border-white/5 text-slate-400 hover:text-white hover:border-white/15"
                          }`}
                        >
                          {num === "none" ? "None" : `#${num}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === "headgear" && (
                <div className="grid grid-cols-2 gap-2">
                  {HEADGEAR_OPTIONS.map((opt) => {
                    const isActive = selectedHeadgear === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedHeadgear(opt.id)}
                        className={`p-3 bg-[#0A0E1A] border-2 rounded-xl flex items-center justify-center transition-all cursor-pointer text-center ${
                          isActive ? "border-[#FF4E00] bg-[#FF4E00]/5 scale-[1.02]" : "border-white/5 hover:border-white/20"
                        }`}
                      >
                        <span className="text-[10px] font-black italic uppercase text-slate-200 tracking-wider pr-1">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === "nation" && (
                <div className="space-y-2.5">
                  <p className="text-[9px] font-mono text-[#8E9299] leading-relaxed">
                    Rep a nation this World Cup — shown next to your name on leaderboards. Not required.
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {/* Clear / none */}
                    <button
                      onClick={() => setSelectedNation("")}
                      className={`aspect-square bg-[#0A0E1A] border-2 rounded-xl flex items-center justify-center text-[8px] font-bold uppercase text-slate-400 transition cursor-pointer ${
                        !selectedNation ? "border-[#FF4E00]" : "border-white/5 hover:border-white/20"
                      }`}
                    >
                      None
                    </button>
                    {NATIONS.map((n) => {
                      const isActive = selectedNation === n.name;
                      return (
                        <button
                          key={n.name}
                          title={n.name}
                          onClick={() => setSelectedNation(n.name)}
                          className={`aspect-square bg-[#0A0E1A] border-2 rounded-xl flex items-center justify-center transition cursor-pointer ${
                            isActive ? "border-[#FF4E00] bg-[#FF4E00]/5 scale-105" : "border-white/5 hover:border-white/20"
                          }`}
                        >
                          <CountryFlag name={n.name} className="w-7 h-5" width={80} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Primary action */}
          <div className="pt-1">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
              className="w-full bg-[#FF4E00] hover:bg-orange-600 text-white font-black italic text-sm py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF4E00]/10 transition-all duration-200"
              id="customizer-submit-btn"
            >
              <Sparkles className="w-4 h-4 fill-white" />
              {confirmLabel}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
