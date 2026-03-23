namespace quote;

using {managed} from '@sap/cds/common';
using {Attachments} from '@cap-js/attachments';

entity Quotations : managed {
    key ID          : UUID;
        Description : String(255);
        file        : LargeBinary  @Core.MediaType: mediaType  @Core.ContentDisposition.Filename: fileName;
        mediaType   : String(255)  @readonly;
        fileName    : String(255);
        attachments : Composition of many Attachments;
}
