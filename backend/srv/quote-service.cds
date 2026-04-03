using {quote} from '../db/schema';

@requires: 'authenticated-user'
service QuoteService {
    @odata.draft.enabled
    entity Quotations as projection on quote.Quotations;
}

service QuoteNonDraftService {
    entity Quotations as projection on quote.Quotations;
}
