using QuoteService as service from './quote-service';

annotate service.Quotations with @(
    UI.FieldGroup #GeneratedGroup: {
        $Type: 'UI.FieldGroupType',
        Data : [
            {
                $Type: 'UI.DataField',
                Label: 'file',
                Value: file
            },
            {
                $Type: 'UI.DataField',
                Label: 'Description',
                Value: Description
            },
            {
                $Type: 'UI.DataField',
                Label: 'mediaType',
                Value: mediaType
            },
            {
                $Type: 'UI.DataField',
                Label: 'fileName',
                Value: fileName
            },
            {
                $Type: 'UI.DataField',
                Value: createdAt
            },
            {
                $Type: 'UI.DataField',
                Value: createdBy
            },
            {
                $Type: 'UI.DataField',
                Value: modifiedAt
            },
            {
                $Type: 'UI.DataField',
                Value: modifiedBy
            },
        ],
    },
    UI.Facets                    : [
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'GeneratedFacet1',
            Label : 'General Information',
            Target: '@UI.FieldGroup#GeneratedGroup',
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'Attachments',
            Label : 'Attachments',
            Target: 'attachments/@UI.LineItem',
        },
    ],
    UI.LineItem                  : [
        {
            $Type: 'UI.DataField',
            Value: createdAt
        },
        {
            $Type: 'UI.DataField',
            Value: createdBy
        },
        {
            $Type: 'UI.DataField',
            Value: modifiedAt
        },
        {
            $Type: 'UI.DataField',
            Value: modifiedBy
        },
        {
            $Type: 'UI.DataField',
            Label: 'Description',
            Value: Description
        },
    ],
);
