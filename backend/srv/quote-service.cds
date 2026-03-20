using {quote} from '../db/schema';

service QuoteService {
    @odata.draft.enabled
    entity Quotations as projection on quote.Quotations;
}
