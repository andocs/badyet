/** What a rehaul form action returns to its form: success, or a plain-language error. */
export interface FormState {
  ok?: boolean;
  error?: string;
}
