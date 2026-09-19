export interface HeaderProps {
  title?: string;
}

export function Header({ title = "AI HACK APP1" }: HeaderProps) {
  return (
    <header className="border-b p-4">
      <h1 className="text-xl font-bold">{title}</h1>
    </header>
  );
}
