"use client";

import dynamic from "next/dynamic";

const ProjectsContent = dynamic(() => import("./projects-content"), {
	loading: () => <div className="bg-background min-h-screen" />,
	ssr: false,
});

export default function ProjectsPage() {
	return <ProjectsContent />;
}
