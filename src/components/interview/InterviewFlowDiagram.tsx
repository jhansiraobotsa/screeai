import { motion } from "framer-motion";

interface Stage {
  id: string;
  label: string;
  shortLabel: string;
}

interface InterviewFlowDiagramProps {
  stages: Stage[];
  currentStageIndex: number;
}

export function InterviewFlowDiagram({ stages, currentStageIndex }: InterviewFlowDiagramProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center gap-0 min-w-max px-2 py-3">
        {stages.map((stage, idx) => {
          const isCompleted = idx < currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          const isPending = idx > currentStageIndex;

          return (
            <div key={stage.id} className="flex items-center">
              {/* Stage node */}
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  className={`relative flex items-center justify-center rounded-full text-xs font-semibold transition-colors
                    ${isCompleted ? "w-7 h-7 bg-primary text-primary-foreground" : ""}
                    ${isCurrent ? "w-9 h-9 bg-primary text-primary-foreground ring-4 ring-primary/30" : ""}
                    ${isPending ? "w-7 h-7 bg-muted text-muted-foreground border border-border" : ""}
                  `}
                  animate={isCurrent ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={isCurrent ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                >
                  {isCompleted ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{idx + 1}</span>
                  )}

                  {isCurrent && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary/20"
                      animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </motion.div>

                <span
                  className={`text-[10px] font-medium text-center leading-tight max-w-[56px] truncate
                    ${isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"}
                  `}
                  title={stage.label}
                >
                  {stage.shortLabel}
                </span>
              </div>

              {/* Connector line */}
              {idx < stages.length - 1 && (
                <div className="relative mx-1 mb-4">
                  <div className="h-0.5 w-8 bg-border rounded-full" />
                  {isCompleted && (
                    <motion.div
                      className="absolute inset-0 h-0.5 bg-primary rounded-full origin-left"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.4 }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
