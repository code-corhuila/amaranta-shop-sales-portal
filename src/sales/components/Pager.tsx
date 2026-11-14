interface Props {
  /** The page being shown. */
  readonly current: number;
  readonly totalPages: number;
  readonly onPage: (page: number) => void;
}

/** Moves one page at a time. It is not drawn when everything fits in one page. */
export function Pager({ current, totalPages, onPage }: Props) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="pager">
      <button type="button" disabled={current <= 1} onClick={() => onPage(current - 1)}>
        Anterior
      </button>
      <p>{`Página ${current} de ${totalPages}`}</p>
      <button type="button" disabled={current >= totalPages} onClick={() => onPage(current + 1)}>
        Siguiente
      </button>
    </nav>
  );
}
