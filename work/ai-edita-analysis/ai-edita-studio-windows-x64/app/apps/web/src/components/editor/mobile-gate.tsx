"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "../ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "mobile-acknowledged";

function subscribeViewport(onChange: () => void) {
	window.addEventListener("resize", onChange);
	window.addEventListener("storage", onChange);
	return () => {
		window.removeEventListener("resize", onChange);
		window.removeEventListener("storage", onChange);
	};
}
function getMobileGateSnapshot() {
	if (window.innerWidth >= 1024) return false;
	try {
		return localStorage.getItem(STORAGE_KEY) !== "true";
	} catch {
		return true;
	}
}
function getServerSnapshot() {
	return null;
}

interface MobileGateProps {
	children: React.ReactNode;
}

export function MobileGate({ children }: MobileGateProps) {
	const router = useRouter();
	const [acknowledged, setAcknowledged] = useState(false);
	const show = useSyncExternalStore<boolean | null>(
		subscribeViewport,
		getMobileGateSnapshot,
		getServerSnapshot,
	);

	if (show === null) return null;
	if (!show || acknowledged) return <>{children}</>;

	const handleContinue = () => {
		try {
			localStorage.setItem(STORAGE_KEY, "true");
		} catch {
			/* Session-only if storage is unavailable. */
		}
		setAcknowledged(true);
	};

	const handleGoBack = () => {
		router.back();
	};

	return (
		<div className="bg-background relative flex h-screen w-screen flex-col overflow-hidden">
			<Button
				variant="text"
				className="absolute top-6 left-6 flex items-center gap-1 text-muted-foreground"
				onClick={handleGoBack}
			>
				<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
				<span className=" text-sm">Go back</span>
			</Button>

			<div className="flex flex-1 flex-col justify-center gap-5 px-7">
				<div className="flex flex-col gap-3">
					<h1 className="text-foreground text-3xl font-bold tracking-tight">
						Desktop only (for now)
					</h1>
					<p className="text-muted-foreground text-sm leading-relaxed">
						AI Edita works best on a desktop browser with a keyboard and mouse.
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Button onClick={handleContinue}>Take a look anyway</Button>
				</div>
			</div>
		</div>
	);
}
