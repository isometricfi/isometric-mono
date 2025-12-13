import { motion } from "framer-motion";

export function YieldDisplay() {
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        viewport={{ once: true }}
        className="relative"
      >
        <div className="relative ">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Active Position
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              CALL
            </span>
          </div>

          <div className="text-center mb-6">
            <div className="text-xs font-mono text-muted-foreground mb-1">ESTIMATED APY</div>
            <div className="text-5xl font-mono font-bold text-primary">
              24.8<span className="text-2xl text-primary/60">%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-xl p-5">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">COLLATERAL</div>
              <div className="text-sm font-mono font-semibold">1.0 BTC</div>
            </div>
            <div className="bg-card rounded-xl p-5">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">PREMIUM</div>
              <div className="text-sm font-mono font-semibold text-green-500">+0.021 BTC</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
