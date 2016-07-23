var common = require('./common');

var db = common.db;
var sendBadRequestResponse = common.sendBadRequestResponse;
var sendBackJSON = common.sendBackJSON;


/* helper functions --------------------------------------------------------*/

/* Takes in a query word and a matching string and returns how well the string
 * matches the query words as an integer score.
 */
function scorePart(query, string) {
    // split the string into words and filter the ones which contain the query
    var matchingWords = string.split(' ').filter(function(word) {
        return word.indexOf(query) !== -1;
    });
    
    // go through each matching word, with a base score relative to the
    // number of matching words
    var score = matchingWords.reduce(function(score, word) {
        // if the word matches at the beginning, add an additional bonus
        if (word.startsWith(query)) {
            score += 5;
        }
        
        var lengthDifference = word.length - query.length;
        
        // for an exact match, add another bonus
        if (lengthDifference === 0) {
            score += 10;
        }
        // otherwise, deduct from the score for every missing letter
        else {
            score -= lengthDifference;
        }
        
        return score;
    }, matchingWords.length * 10);
    
    return score;
}


/* Takes in two strings, a query string and a matching string, and returns the
 * sum of the score of each word in the query string in the matching string.
 */
function scoreString(queryString, string) {
    return queryString.split(' ').reduce(function(score, query) {
        return score + scorePart(query, string);
    }, 0);
}


/* Goes through an array of results and adds a score field to each one. The score
 * field be set to how well the text in each result's searchField matches with
 * each word in the query.
 */
function scoreResults(query, searchField, results) {
    results.forEach(function(result) {
        result.score = scoreString(query.toLowerCase(), result[searchField].toLowerCase());
    });
}


/* Compares the scores of two results.
 *
 * Returns 0 if the scores are the same, > 0 if result2 has a higher score,
 * or <0 if result1 has a higher score.
 */
function compareResultScores(result1, result2) {
    return result2.score - result1.score;
}


/* Sorts an array of results which have scores, ordering them in descending
 * order of score.
 */
function sortResults(results) {
    results.sort(compareResultScores);
}


/* Removes elements from the end of the results until the specified limit
 * has been reached. If the limit is null, no results will be removed.
 */
function limitResults(limit, results) {
    if (limit !== null) {
        while (results.length > limit) {
            results.pop();
        }
    }
}


/* Runs a given query for search results, adds scores to the results
 * and calls the callback with an ordered and limited list of the results.
 *
 * Note that the query must have a column called 'matchingString', which will
 * be used for scoring. Moreover, to work with the jQuery autocomplete, either
 * the query or the callback should:
 *  1. Add a 'data' field.
 *  2. Add a 'value' field.
 *  3. Wrap the results in an objections under the key 'suggestions'.
 */
function search(query, searchString, limit, callback) {
    db.query(query, {bind: ['%' + searchString + '%']}).spread(function(results, metadata) {
       scoreResults(searchString, 'matchingString', results);
       sortResults(results);
       limitResults(limit, results);

       callback(results);
   });
}


/* Takes in a name and username of a user and merges them into a readable string */
function mergeNameAndUsername(name, username) {
    if (name && username) {
        return name + ' (' + username + ')';
    }
    else if (username) {
        return username;
    }
    else {
        return name;
    }
}


/* Searches for users by name and calls the callback with the results. */
function searchUsersByName(searchString, limit, callback) {
    var query =
        'SELECT U.name, LC.username, U.id AS data, ' +
            'U.name AS matchingString ' +
        'FROM USERS U ' +
        'LEFT OUTER JOIN LOGIN_CREDENTIALS LC ' +
            'ON LC.user_id = U.id ' +
        'WHERE U.name LIKE $1 '
    ;
    
   search(query, searchString, limit, function(results) {
       // add a value field and strip out unneeded fields
       results.forEach(function(result) {
           result.value = mergeNameAndUsername(result.name, result.username);

           result['matchingString'] = undefined;
           result['name'] = undefined;
           result['username'] = undefined;
       });
       
       callback(results);
   });
}


/* Searches for users by username and calls the callback with the results. */
function searchUsersByUsername(searchString, limit, callback) {
    var query =
        'SELECT U.name, LC.username, U.id AS data, ' +
            'LC.username AS matchingString ' +
        'FROM USERS U ' +
        'INNER JOIN LOGIN_CREDENTIALS LC ' +
            'ON LC.user_id = U.id ' +
        'WHERE LC.username LIKE $1 '
    ;
    
    search(query, searchString, limit, function(results) {
        // add a value field and strip out unneeded fields
        results.forEach(function(result) {
            result.value = mergeNameAndUsername(result.name, result.username);

            result['matchingString'] = undefined;
            result['name'] = undefined;
            result['username'] = undefined;
        });

       callback(results);
   });
}


/* Returns all items in results1 which do not appear in results2 (based on the
 * data field) or which have a higher score.
 */
function _mergeResults(results1, results2) {
    return results1.filter(function(result1) {
        var duplicateResult = results2.find(function(result2) {
            // return true if the userIds match
            return result1.data == result2.data;
        });
        
        return (!duplicateResult || duplicateResult.score < result1.score);
    });
}


/* Returns an array of items from results1 and results2 which either do not
 * belong in the other or which have a higher score.
 */
function mergeResults(results1, results2) {
    return _mergeResults(results1, results2).concat(_mergeResults(results2, results1));
}


/* Searches for users by name username and calls the callback with the results. */
function searchUsers(searchString, limit, callback) {
    searchUsersByName(searchString, null, function(nameResults) {
        searchUsersByUsername(searchString, null, function(usernameResults) {
            // merge the two result arrays, resolving duplicates by keeping
            // the one with the higher score
            var results = mergeResults(nameResults, usernameResults);
            
            // resort the merged results and then add a limit on them
            // so that we limit the highest amongst both searches
            sortResults(results);
            limitResults(limit, results);
            
            // finally call the callback
            callback(results);
        });
    });
}


/* Wraps the results as required by jQuery's autocomplete library and sends
 * it as the response.
 */
function returnResults(results, res) {
    sendBackJSON({'suggestions': results}, res);
}

/* exported library functions ----------------------------------------------*/

/* Handles all requests directed to the search service. */
exports.handleSearch = function(req, res) {
    var searchString = req.query.q;
    var searchType = req.query.type;
    var limit = req.query.limit ? req.query.limit : null;
    
    console.log('search for [' + searchString + '] with type [' + 
        searchType + ']; limit is [' + limit + ']');
    
    if (!searchString) {
        sendBadRequestResponse({'status': 'no search query provided'}, res);
    }
    else {
        switch(searchType) {
            case 'usersbyname':
                searchUsersByName(searchString, limit, function(results) {
                    returnResults(results, res);
                });
                break;
            
            case 'usersbyusername':
                searchUsersByUsername(searchString, limit, function(results) {
                    returnResults(results, res);
                });
                break;
            
            case 'users':
                searchUsers(searchString, limit, function(results) {
                    returnResults(results, res);
                });
                break;
            
            default:
                sendBadRequestResponse({'status': 'unknown search type'}, res);
                break;
        }
    }
}
