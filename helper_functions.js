const { DateTime, Interval, Duration } = require("luxon");
const purify = require("isomorphic-dompurify");

/**
 * Shuffles an array
 * @param {Object[]} array an array to be shuffled
 * @returns a shuffled array
 */
let shuffle = function (array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
}

let isInt = function (value) {
    return !isNaN(value) &&
        parseInt(Number(value)) == value &&
        !isNaN(parseInt(value, 10));
}

let formatBytes = function (bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

let valid_file_name = function (string) {
    if(string != null &&  typeof string == "string"){
        if(string.trim().length == 0){
            return false;
        }
        return (/^[\w\-. ]+$/gm.test(string));
    }
    return false;
}

let get_type = function(obj){
    return Object.prototype.toString.call(obj).slice(8, -1);
}

let create_edge_n_grams = function(str) {
    if (str && str.length > 3) {
        const minGram = 3
        const maxGram = str.length
        
        return str.split(" ").reduce((ngrams, token) => {
            if (token.length > minGram) {   
                for (let i = minGram; i <= maxGram && i <= token.length; ++i) {
                    ngrams = [...ngrams, token.substr(0, i)]
                }
            } else {
                ngrams = [...ngrams, token]
            }
            return ngrams
        }, []).join(" ")
    } 
    
    return str
}


/**
 * 
 * @param {Object} object an objec to validate
 * @param {Object} object_map An object map that contains a key that matches with a key in the object and 
 *      - {key: options}
 *          OPTIONS: 
 *              - type - the type of object (required)
 *              - sanitize - [default: false] sanitizes the value
 *              - parse - [default: null] what to parse the value to [number, string, date]
 *              - parse_before - [default: true] - parse the value before checking the type
 *              - parse_after - [default: true] - parse the value after checking the type
 * @param {Object} options an options object to change,
 *      - remove_extra_keys - [default: false] removes any keys that arent specified in the object_map
 *      - return_extra_keys - [default: false] returns the extra keys that arent specified in the object_map, can be used with remove_extra_keys
 *      - return_rejected_keys - [default: true] returns the key values that dont match up with the object_map (rejected keys are ones where the value does not match the type)
 *      - remove_rejected_keys - [default: true] remove the key_value pair that dont match up with the object_map type
 *      - return_dne_keys - [default : true] return keys that "do not exist" (dne), if they dont exist in the object, return them
 *      - remove_dne_keys - [default : true] removes the key_value pairs of keys that do not exist
 *     
 * @returns an object containing the validated object with the extra keys that were remove (if requested and if their were extra keys). if 
 */
let object_validator = function(object, object_map, options){
    let object_keys = Object.keys(object);
    
    let remove_extra_keys = options.remove_extra_keys ? options.remove_extra_keys : false;
    let return_extra_keys = options.return_extra_keys ? options.return_extra_keys : false;

    let return_rejected_keys = options.return_rejected_keys ? options.return_rejected_keys : true;
    let remove_rejected_keys = options.remove_rejected_keys ? options.remove_rejected_keys : true;

    let return_dne_keys = options.return_dne_keys ? options.return_dne_keys : true;
    let remove_dne_keys = options.remove_dne_keys ? options.remove_dne_keys : true;

    let extra_keys = [];
    let rejected_keys = [];

    let dne_keys = [];
    let object_map_keys = Object.keys(object_map);
    for(let key of object_map_keys){
        if(!object.hasOwnProperty(key)){
            if(return_dne_keys){
                dne_keys.push(key);
            }
            if(remove_dne_keys){
                delete object[key];
            }
        }
    }
    
    for(let key of object_keys){
        if(object_map.hasOwnProperty(key)){//check if a key in the object exists in the object_map
            let object_value = object[key];
            let object_map_value = object_map[key];

            let type = object_map_value.type;
            let sanitize = object_map_value.sanitize;
            let parse = object_map_value.parse;
            let parse_before = object_map_value.parse_before ? object_map_value.parse_before : true;
            let parse_after = object_map_value.parse_after ? object_map_value.parse_after : true;

            let parse_function = function (value, parse_to){
                if(parse_to == "number"){
                    if(!isNaN(value)){
                        value = Number(value);
                    }
                }
                else if(parse_to == "string"){
                    value = String(value);
                }
                else if(parse_to == "date"){
                    let date = new Date(value);
                    if(!isNaN(date)){
                        value = date;
                    }
                }
                return value;
            }

            //checks the type of the value
            //if the type of the value does not match, this object is not valid
            if(type == null){
                if(object_value != type){//if the object type is null, then it is valid
                    rejected_keys.push(key);
                    if(remove_rejected_keys){
                        delete object[key];
                    }
                }
            }
            else{//the type is not null
                if(parse_before == true && parse != null){
                    object[key] = parse_function(object[key], parse);
                }
                if(get_type(object[key]) == type){//if the type is valid, then do value manipulation
                    if(sanitize){
                        object[key] = purify.sanitize(object[key]);
                    }
                    if(parse_after == true && parse != null){
                        object[key] = parse_function(object[key], parse);
                    }
                }
                else{
                    if(return_rejected_keys){
                        rejected_keys.push(key);
                    }
                    if(remove_rejected_keys){
                        delete object[key];
                    }
                }
            }
        }
        //if object_map doesn't contain a key that object has than it is an extra key
        //if there are extra_keys, than the object can still be valid
        else{
            if(return_extra_keys){
                extra_keys.push(key);
            }
            if(remove_extra_keys){
                delete object[key];
            }
        }
    }

    let result = {
        object: object
    }
    if(return_extra_keys){
        result.extra_keys = extra_keys;
    }
    if(return_rejected_keys){
        result.rejected_keys = rejected_keys;
    }
    if(return_dne_keys){
        result.dne_keys = dne_keys;
    }
    return result;
}

module.exports = {
    shuffle: shuffle,
    isInt: isInt,
    formatBytes: formatBytes,
    valid_file_name: valid_file_name,
    object_validator: object_validator,
    create_edge_n_grams: create_edge_n_grams,
    DateTime: DateTime,
    Interval: Interval,
    Duration: Duration
}