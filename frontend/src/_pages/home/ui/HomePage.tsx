import { Header } from "@/widgets/header";

export function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-6">
        <h2 className="text-lg font-semibold">Welcome to AI HACK APP1</h2>
        <p className="text-sm text-gray-500 mt-2">
          Project foundation successfully configured.
        </p>
      </main>
    </div>
  );
}
