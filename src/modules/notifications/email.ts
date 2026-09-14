/**
 * Porta del provider email.
 *
 * L'adattatore predefinito non spedisce niente: scrive a console. E' una scelta,
 * non una dimenticanza. Un finto invio che restituisce "inviato" senza spedire
 * nulla e' peggio di un invio assente, perche' nasconde il fatto che il
 * provider non e' configurato: l'utente aspetterebbe una email che non arriva
 * mai e nessuno se ne accorgerebbe.
 *
 * `describeDelivery()` dice sempre la verita' sullo stato della consegna, e
 * l'interfaccia la mostra all'utente.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type DeliveryResult = {
  /** Vero solo se il messaggio e' stato affidato a un servizio che lo spedisce davvero. */
  delivered: boolean;
  provider: string;
  /** Presente solo con l'adattatore di sviluppo: il link da aprire a mano. */
  developmentPreview?: string;
};

export interface EmailProvider {
  readonly name: string;
  readonly deliversForReal: boolean;
  send(message: EmailMessage): Promise<DeliveryResult>;
}

class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  readonly deliversForReal = false;

  async send(message: EmailMessage): Promise<DeliveryResult> {
    console.info(
      [
        "",
        "─".repeat(72),
        "EMAIL NON SPEDITA — nessun provider configurato",
        `A:       ${message.to}`,
        `Oggetto: ${message.subject}`,
        "",
        message.text,
        "─".repeat(72),
        ""
      ].join("\n")
    );
    const link = /https?:\/\/\S+/.exec(message.text)?.[0];
    return { delivered: false, provider: this.name, developmentPreview: link };
  }
}

let provider: EmailProvider = new ConsoleEmailProvider();

export function getEmailProvider(): EmailProvider {
  return provider;
}

/** Punto d'innesto per l'adattatore reale, quando il provider sara' scelto. */
export function setEmailProvider(next: EmailProvider) {
  provider = next;
}

export function describeDelivery(result: DeliveryResult): string {
  return result.delivered
    ? "Messaggio inviato."
    : "Nessun servizio di posta e' configurato: il messaggio non e' stato spedito.";
}
