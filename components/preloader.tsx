"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Preloader() {
	const [isLoading, setIsLoading] = useState(true);
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		// Simulate loading progress from 0 to 100
		const progressInterval = setInterval(() => {
			setProgress((prev) => {
				if (prev >= 100) {
					clearInterval(progressInterval);
					setTimeout(() => setIsLoading(false), 300);
					return 100;
				}
				// Random increment between 5-15 for realistic loading
				return Math.min(prev + Math.floor(Math.random() * 10) + 5, 100);
			});
		}, 100);

		return () => clearInterval(progressInterval);
	}, []);	return (
		<AnimatePresence mode="wait">
			{isLoading && (
				<motion.div
					initial={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.5, ease: "easeInOut" }}
					className="fixed inset-0 z-50 flex items-center justify-center bg-linear-to-br from-background via-background to-muted/30"
				>
					{/* Background Grid Pattern */}
					<div className="absolute inset-0 pointer-events-none overflow-hidden">
						<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[4rem_4rem]"></div>
						
						{/* Gradient orbs */}
						<div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
						<div
							className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"
							style={{ animationDelay: "1s" }}
						></div>
					</div>

					<div className="relative flex flex-col items-center gap-8">
						{/* Logo - Same as homepage */}
						<motion.div
							initial={{ scale: 0.8, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{
								duration: 0.5,
								ease: "easeOut",
							}}
							className="inline-flex items-center gap-3 mb-2"
						>
							<motion.div 
								className="p-3 rounded bg-primary/10 border border-primary/20"
								animate={{
									scale: [1, 1.05, 1],
								}}
								transition={{
									duration: 2,
									repeat: Infinity,
									ease: "easeInOut",
								}}
							>
								<div className="h-8 w-8 bg-primary rounded"></div>
							</motion.div>
						</motion.div>

						{/* PaperPaste Text with blend animation */}
						<motion.h1
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2, duration: 0.5 }}
							className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-center"
						>
							PaperPaste
						</motion.h1>

						{/* Progress bar */}
						<div className="w-64 sm:w-80">
							<div className="flex items-center justify-between mb-2">
								<motion.p
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ delay: 0.4 }}
									className="text-sm text-muted-foreground"
								>
									Loading...
								</motion.p>
								<motion.span
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ delay: 0.4 }}
									className="text-sm font-semibold text-primary"
								>
									{progress}%
								</motion.span>
							</div>
							
							{/* Progress bar track */}
							<div className="h-1.5 bg-muted rounded-full overflow-hidden border border-border/50">
								<motion.div
									className="h-full bg-linear-to-r from-primary via-primary/80 to-primary rounded-full relative"
									initial={{ width: 0 }}
									animate={{ width: `${progress}%` }}
									transition={{ duration: 0.2, ease: "easeOut" }}
								>
									{/* Shimmer effect */}
									<motion.div
										className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent"
										animate={{
											x: ["-100%", "100%"],
										}}
										transition={{
											duration: 1.5,
											repeat: Infinity,
											ease: "linear",
										}}
									/>
								</motion.div>
							</div>
						</div>

						{/* Loading message */}
						<motion.p
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.6 }}
							className="text-sm text-muted-foreground"
						>
							Preparing your secure clipboard...
						</motion.p>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
