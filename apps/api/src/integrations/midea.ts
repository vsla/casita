// Nuvem · Lavanderia Midea — integração FUTURA.
// Adaptador vazio de propósito: nenhum status de máquina é exibido até existir
// uma conexão real e verificada com o modelo da casa.
export interface LaundryAdapter {
  /** Estado real da máquina, ou null quando não há conexão. */
  getCycle(): Promise<{ state: 'idle' | 'running' | 'done'; remainingMin: number | null } | null>;
}

export const mideaLaundry: LaundryAdapter = {
  async getCycle() {
    return null;
  },
};
