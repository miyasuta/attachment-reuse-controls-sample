namespace quote;

using {managed} from '@sap/cds/common';
using {Attachments} from '@cap-js/attachments';

entity Quotations : managed {
    key ID          : UUID;
        Description : String(255);
        file        : LargeBinary @Core.MediaType: mediaType;
        mediaType   : String(255);
        fileName    : String(255);
        attachments : Composition of many Attachments;
}
