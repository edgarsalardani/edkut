interface LogoProps {
  size?: "sm" | "md" | "lg";
  withSlogan?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
};

/**
 * Logotipo textual e original do EdKut: nome em minúsculas, "ed" em azul e
 * "kut" em rosa/magenta, com dois pontos de conexão simbolizando pessoas
 * conectadas por interesses em comum. Não reproduz nenhuma marca do Orkut.
 */
export function Logo({ size = "md", withSlogan = false, className = "" }: LogoProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      <span className={`font-heading font-black tracking-tight ${SIZE_MAP[size]}`}>
        <span className="text-edkut-blue">ed</span>
        <span className="text-edkut-pink">kut</span>
        <span className="ml-0.5 inline-block align-super text-edkut-pink" style={{ fontSize: "0.4em" }}>
          ●●
        </span>
      </span>
      {withSlogan && (
        <span className="mt-0.5 text-xs italic text-edkut-muted">
          conectando quem aprende, ensina e compartilha tecnologia
        </span>
      )}
    </div>
  );
}
