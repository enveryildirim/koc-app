import { buildForm, FormSpec, PAGE_H, PAGE_W } from "./layout";

export default function FormSvg({ info, className, style }: { info: FormSpec; className?: string; style?: React.CSSProperties }) {
  const prims = buildForm(info);
  return (
    <svg viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <rect width={PAGE_W} height={PAGE_H} fill="#fff" />
      {prims.map((p, i) => {
        switch (p.kind) {
          case "rect":
            return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.sw} />;
          case "circle":
            return <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.sw} />;
          case "line":
            return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.sw} />;
          case "text":
            return (
              <text
                key={i}
                x={p.x}
                y={p.y}
                fontSize={p.size}
                fill={p.fill}
                textAnchor={p.anchor ?? "start"}
                fontWeight={p.bold ? 700 : 400}
                fontFamily="Arial, Helvetica, sans-serif"
              >
                {p.text}
              </text>
            );
        }
      })}
    </svg>
  );
}
