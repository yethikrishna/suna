"use client";

import { SquareKanban, X } from "lucide-react";
import { useParams } from "next/navigation";
import { SessionChat } from "@/features/session/session-chat";
import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SubSessionModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sessionId: string;
	title?: string;
}

export function SubSessionModal({
	open,
	onOpenChange,
	sessionId,
	title,
}: SubSessionModalProps) {
	// Every caller is a tool renderer deep inside a project session route, and
	// none of them carries the project id. Read it from the route instead of
	// threading a prop through six call sites: without it the inner SessionChat's
	// agent roster falls back to the AMBIENT sandbox `GET /agent`, which a managed
	// ACP runtime does not serve.
	const routeParams = useParams<{ id?: string }>();
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				hideCloseButton
				className={cn(
					"flex flex-col p-0 gap-0 overflow-hidden",
					// sm:max-w-* is required — the base dialog sets sm:max-w-lg, which
					// tailwind-merge won't strip for an unprefixed max-w-* override.
					"w-[92vw] max-w-6xl sm:max-w-6xl h-[80vh] max-h-[840px]",
				)}
				aria-describedby={undefined}
			>
				{/* Header bar */}
				<div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-muted/30 shrink-0">
					<SquareKanban className="size-3.5 text-muted-foreground flex-shrink-0" />
					<DialogTitle className="text-sm font-medium truncate flex-1">
						{title || "Sub-session"}
					</DialogTitle>
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className={cn(
							"flex items-center justify-center size-6 rounded-md",
							"text-muted-foreground hover:text-foreground",
							"hover:bg-muted/60 transition-colors",
						)}
					>
						<X className="size-3.5" />
					</button>
				</div>

				{/* Session chat — read-only, no header */}
				<div className="flex-1 min-h-0 overflow-hidden">
			<SessionChat
					sessionId={sessionId}
					projectId={routeParams?.id}
					hideHeader
					readOnly
					initialScrollTop
				/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
