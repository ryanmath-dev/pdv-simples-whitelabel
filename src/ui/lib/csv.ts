/**
 * Utilitários CSV simples (sem dependência externa). Suporta campos entre
 * aspas, vírgulas internas e aspas escapadas ("").
 */

/** Faz o parse de um texto CSV em uma matriz de linhas/colunas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\r') {
      // ignora; trata \n
    } else if (c === '\n') {
      pushRow();
    } else {
      field += c;
    }
  }
  // última linha (se houver conteúdo)
  if (field !== '' || row.length > 0) pushRow();
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Serializa uma matriz em texto CSV (com aspas quando necessário). */
export function toCsv(rows: (string | number)[][]): string {
  const escape = (val: string | number): string => {
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return rows.map((r) => r.map(escape).join(',')).join('\r\n');
}

/** Dispara o download de um texto como arquivo (no navegador). */
export function downloadText(filename: string, content: string, mime = 'text/csv'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
