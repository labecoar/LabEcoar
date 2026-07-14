// @ts-nocheck
import React from "react";
import { Music2, Mic, Users, PartyPopper } from "lucide-react";
import { useGroupProgress } from "@/hooks/useScores";
import { GROUP_TARGET_FACTOR, MAX_JOURNEY_POINTS } from "@/services/scores.service";
import { C, heading, body } from "@/lib/theme";

export const LEVEL_THRESHOLDS = [
  { key: "voz_e_violao", name: "Voz e Violão", min: 0, max: 200, icon: Music2 },
  { key: "dueto", name: "Dueto", min: 201, max: 500, icon: Mic },
  { key: "fanfarra", name: "Fanfarra", min: 501, max: 1000, icon: Users },
  { key: "carnaval", name: "Carnaval", min: 1001, max: 1500, icon: PartyPopper },
];

export const MAX_GROUP_PTS = 1500;

export const LEVELS = LEVEL_THRESHOLDS.map(({ name, max, icon }) => ({
  name,
  pts: max,
  icon,
}));

export function groupThreshold(pts, activeEcoantes = 1) {
  return Math.round(pts * Math.max(activeEcoantes, 1) * GROUP_TARGET_FACTOR);
}

export function getGroupLevelIndex(collectivePoints = 0, activeEcoantes = 1) {
  let highestCompleted = -1;
  LEVELS.forEach((level, i) => {
    if (collectivePoints >= groupThreshold(level.pts, activeEcoantes)) {
      highestCompleted = i;
    }
  });
  return highestCompleted;
}

export function getGroupCategory(collectivePoints = 0, activeEcoantes = 1) {
  const idx = getGroupLevelIndex(collectivePoints, activeEcoantes);
  return LEVELS[idx !== -1 ? idx : 0];
}

function GroupProgressBar({ groupPct, targetPoints }) {
  const rounded = Math.round(groupPct);
  const dotLeft = `clamp(0px, calc(${groupPct}% - 8px), calc(100% - 16px))`;

  return (
    <div className="w-full">
      <div className="relative w-full mb-2 py-[3px]">
        <div
          className="relative h-2.5 rounded-full w-full overflow-hidden"
          style={{ backgroundColor: "rgba(255,255,222,0.07)" }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${groupPct}%`,
              background: `linear-gradient(90deg, ${C.blue} 0%, ${C.lime} 100%)`,
            }}
          />
        </div>

        <div
          className="absolute top-1/2 -translate-y-1/2 size-4 rounded-full z-20 shrink-0 transition-all duration-500"
          style={{
            left: dotLeft,
            backgroundColor: C.lime,
            boxShadow: `0 0 10px ${C.lime}CC, 0 0 24px ${C.lime}66`,
          }}
        />
      </div>

      <div className="flex justify-between mb-7">
        <span style={{ fontSize: 10, color: `${C.cream}30` }}>0</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.lime }}>{rounded}% concluído</span>
        <span style={{ fontSize: 10, color: `${C.cream}30` }}>{Number(targetPoints).toLocaleString("pt-BR")} pts</span>
      </div>
    </div>
  );
}

function LevelColumn({ level, collectivePoints, index, groupLevelIdx, activeEcoantes }) {
  const Icon = level.icon;
  const lvlThreshold = groupThreshold(level.pts, activeEcoantes);
  const completed = collectivePoints >= lvlThreshold;
  const isCurrent = index === groupLevelIdx;
  const isNext = index === groupLevelIdx + 1;
  const lvlPct = Math.min(100, Math.round((collectivePoints / lvlThreshold) * 100));

  const iconBg = completed ? C.lime : isNext ? C.darkGreen : "rgba(255,255,222,0.05)";
  const iconColor = completed ? C.black : isNext ? C.orange : `${C.cream}15`;
  const nameColor = completed ? C.lime : isNext ? C.cream : `${C.cream}25`;

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 transition-all"
        style={{
          backgroundColor: iconBg,
          border: !completed ? `1px solid rgba(255,255,222,0.07)` : "none",
          boxShadow: isCurrent ? `0 0 20px ${C.lime}44` : "none",
        }}
      >
        <Icon size={18} style={{ color: iconColor }} />
      </div>

      <div style={{ ...heading, fontSize: 12, fontWeight: 700, color: nameColor, marginBottom: 2 }}>
        {level.name}
      </div>

      <div style={{ fontSize: 10, color: `${C.cream}30` }}>
        {lvlThreshold.toLocaleString("pt-BR")} pts
      </div>

      <div className="h-0.5 w-12 rounded-full mt-2.5 overflow-hidden" style={{ backgroundColor: "rgba(255,255,222,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${completed ? 100 : isNext ? lvlPct : 0}%`,
            backgroundColor: completed ? C.lime : C.orange,
          }}
        />
      </div>

      <div style={{ fontSize: 9, color: `${C.cream}30`, marginTop: 3 }}>
        {completed ? "100%" : isNext ? `${lvlPct}%` : "0%"}
      </div>
    </div>
  );
}

export default function GroupProgress({ selectedQuarter }) {
  const { data, isLoading } = useGroupProgress(selectedQuarter);

  const activeEcoantes = data?.active_ecoantes ?? 0;
  const collectivePoints = data?.collective_points ?? 0;
  const targetPoints = data?.target_points ?? 0;
  const progressPercentage = data?.progress_percentage ?? 0;

  const groupLevelIdx = getGroupLevelIndex(collectivePoints, activeEcoantes || 1);
  const groupPct = isLoading ? 0 : progressPercentage;

  const formatPts = (value) => Number(value).toLocaleString("pt-BR");

  return (
    <div
      className="relative rounded-2xl shrink-0 w-full"
      style={{ backgroundColor: C.black_back }}
    >
      <div
        aria-hidden
        className="absolute border border-solid inset-0 pointer-events-none rounded-2xl"
        style={{ borderColor: "rgba(255,255,222,0.06)" }}
      />

      <div className="flex flex-col gap-7 items-start pt-[25px] px-[25px] pb-[25px] relative w-full">
        <div className="flex items-start justify-between w-full gap-4">
          <div>
            <span
              style={{
                ...heading,
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,222,0.31)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              Progresso da Comunidade
            </span>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Users size={13} style={{ color: C.lime}} />
              <span style={{ fontSize: 13, color: `${C.cream}55`, ...body }}>
                {isLoading
                  ? "..."
                  : `${activeEcoantes} Ecoantes · ${formatPts(collectivePoints)} / ${formatPts(targetPoints)} pts coletivos`}
              </span>
            </div>
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.55,
                color: "rgba(255,255,222,0.35)",
                ...body,
                marginTop: 10,
              }}
            >
              Oie! Essa é a sua barra de progressão em equipe. Toda vez que você fizer missões, essa barra aumenta e você pode ver a progressão de todos os Ecoantes ativos da plataforma. Não se preocupe, os pontos convertidos em recompensas não são tirados daqui!
            </p>
          </div>


          {selectedQuarter && (
            <span className="shrink-0" style={{ fontSize: 11, color: "rgba(255,255,222,0.19)" }}>
              {selectedQuarter}
            </span>
          )}
        </div>

        <div className="w-full">
          <GroupProgressBar
            groupPct={groupPct}
            targetPoints={targetPoints}
          />

          <div className="grid grid-cols-4 gap-3 w-full">
            {LEVELS.map((level, index) => (
              <LevelColumn
                key={level.name}
                level={level}
                index={index}
                collectivePoints={collectivePoints}
                groupLevelIdx={groupLevelIdx}
                activeEcoantes={activeEcoantes || 1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
