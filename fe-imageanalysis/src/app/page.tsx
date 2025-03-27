import { DockerDiagnostics } from "@/components/docker-diagnostics";

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Docker Image 진단</h1>
      <DockerDiagnostics />
    </main>
  );
}
