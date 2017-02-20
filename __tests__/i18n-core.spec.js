import i18n from '../generators/i18n/core';

describe('i18n', function() {

    beforeEach(function () {
        i18n.decl({
            'keyset1' : {
                'key1' : 'keyset1 key1 string',
                'key2' : function(params) {
                    return 'keyset1 key2 function ' + JSON.stringify(params);
                },
                'key3' : function(params) {
                    return 'keyset1 key3 ' + this('keyset1', 'key2', params);
                }
            }
        });
    });

    afterEach(function() {
        i18n._reset();
    });

    it('should throw exception without data', function() {
        i18n._reset();

        expect(i18n.bind(i18n, 'keyset1', 'key1')).toThrow('i18n need to be filled with data');
    });

    it('should properly bind in case of one argument', function() {
        const keyset1 = i18n('keyset1');

        expect(keyset1).toBeInstanceOf(Function);
        expect(keyset1('key1')).toBe('keyset1 key1 string');
    });

    it('should return "keyset:key" if it does not exist in data', function() {
        expect(i18n('undefkeyset', 'undefkey')).toBe('undefkeyset:undefkey');
        expect(i18n('keyset1', 'undefkey')).toBe('keyset1:undefkey');
    });

    it('should return string value', function() {
        expect(i18n('keyset1', 'key1')).toBe('keyset1 key1 string');
    });

    it('should return value as function result', function() {
        expect(i18n('keyset1', 'key2', { a : '1' })).toBe('keyset1 key2 function {"a":"1"}');
    });

    it('should properly call another i18n items', function() {
        expect(i18n('keyset1', 'key3', { b : '2' })).toBe('keyset1 key3 keyset1 key2 function {"b":"2"}');
    });

    it('should properly extend existed data', function() {
        i18n.decl({
            'keyset1' : {
                'key0' : 'keyset1 key0 string',
                'key1' : 'keyset1 key1 new string'
            },
            'keyset2' : {
                'key1' : 'keyset2 key1 string'
            }
        });

        expect(i18n('keyset1', 'key0')).toBe('keyset1 key0 string');
        expect(i18n('keyset1', 'key1')).toBe('keyset1 key1 new string');
        expect(i18n('keyset1', 'key2', { a : '1' })).toBe('keyset1 key2 function {"a":"1"}');
        expect(i18n('keyset2', 'key1')).toBe('keyset2 key1 string');
    });
});
