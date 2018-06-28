/*
  ________                    .__      __________           .___             
 /  _____/___________  ______ |  |__   \______   \ ____   __| _/____ ___  ___
/   \  __\_  __ \__  \ \____ \|  |  \   |       _// __ \ / __ |/ __ \\  \/  /
\    \_\  \  | \// __ \|  |_> >   Y  \  |    |   \  ___// /_/ \  ___/ >    < 
 \______  /__|  (____  /   __/|___|  /  |____|_  /\___  >____ |\___  >__/\_ \
        \/           \/|__|        \/          \/     \/     \/    \/      \/
 Christophe.Scholliers@UGent and Thomas.Dupriez@ens-paris-saclay.fr
*/

// #############################
// ##### Notes (Start)

// The fact that the nodes in the visualisation have their id as label instead of something else
//  has been obtained by replacing the line "captionText = style.interpolate(template, node.id, node.propertyMap);"
//  with "captionText = style.interpolate(node.id);" in neod3.js

// Good introduction to the cypher query language: https://neo4j.com/developer/cypher-query-language/

// ##### Notes (End)
// #############################

window.onload = function() {
    setBehaviourClosingContextualMenu();
    connectToNeo4jDatabase();
    setUpConnectionWithRacketServer("8081");
    refreshGraph();
};

window.writePathQueryTemplateToQueryEditor = function() {
    // console.log();
    // $("#cypher").value = "Hello";
    window.codeMirrorEditor
        .getDoc()
        .setValue(
            "MATCH p ((e)-[:REDUCESTO*]->(f:Term <ResearchCriteriaForTargetNodeForExample{x: 25}>)) WHERE ID(e)= <IDOfTheSourceNodeOfTheProgram> RETURN p \n",
        );
    // document.getElementById("cypher").value = "hey";
};

// #############################
// ##### Generic (Start)
var logErrorFunction = (error) => {
    console.log(error);
};
function logErrorAndRejectPromiseFunctionFactory(reject) {
    return (error) => {
        console.log(error);
        reject(error);
    };
}
function cypherErrorPrintAndRejectPromiseFunctionFactory(reject) {
    return (error) => {
        console.log("Cypher error:");
        console.log(error);
        reject(error);
    };
}
// If set to true, will print the messages sent and received from the racket server in the console
var verboseRacketServerInteraction = false;
// ##### Generic (End)
// #############################

// #############################
// ##### Contextual Menu (Start)

// This function is called in neod3.js when a node is clicked on the graph visualisation
window.onNodeClicked = function(node) {
    // Sets the text displayed in the ace editor to the term of the node that was clicked
    editor.setValue(node.propertyMap.term);
    showContextualMenuForNode(node);
    // Stores which node was clicked on, so that the buttons of the contextual menu know on which node to act
    setNodeForContextualMenu(node);
};

// Have it so that any click closes the contextual menu
function setBehaviourClosingContextualMenu() {
    document.getElementById("divbody").onclick = (e) => {
        closeContextualMenu();
    };
}

// Stores which node was clicked last. To be used by the buttons of the contextual menu to know on which node to act.
var nodeForContextualMenu = null;
window.getNodeForContextualMenu = function() {
    return nodeForContextualMenu;
};
function setNodeForContextualMenu(node) {
    nodeForContextualMenu = node;
}

// Takes a node of the visualisation and show a contextual menu for it
function showContextualMenuForNode(node) {
    var graphArea = document.getElementById("graph");
    // Makes the contextual menu visible
    document.getElementById("rmenu").className = "show";
    // Positions the contextual menu on the node that was clicked
    document.getElementById("rmenu").style.top =
        node.py + graphArea.offsetTop + "px";
    document.getElementById("rmenu").style.left = node.px + "px";
}

function closeContextualMenu() {
    document.getElementById("rmenu").className = "hide";
}

window.contextualMenuAction_ReduceOnce = function(node) {
    return window.reduceTermOneStepAndUpdateDatabase(node.propertyMap.term);
};

window.contextualMenuAction_ReduceFiftySteps = function(node) {
    var promise = new Promise((resolve, reject) => {
        var numberOfReductionSteps = 50;
        function reductionFold(promise, id) {
            var newPromise = new Promise((resolve, reject) => {
                promise.then((reductionState) => {
                    // console.log("reductionFold on id: "+id);
                    // console.log("reductionState= ", reductionState);
                    if (reductionState.iDsOfReducedNodes.includes(id)) {
                        // Node has already been reduced, transmitting the state
                        // console.log("Node already reduced");
                        resolve(reductionState);
                    } else {
                        // Node has NOT already been reduced
                        // Fetch the term of the node to be reduced
                        // console.log("Node NOT already reduced");
                        getAttributeOfNode(id, "term").then((term) => {
                            // Reduce term
                            window
                                .reduceTermOneStepAndUpdateDatabase(term)
                                .then((iDs) => {
                                    // console.log("iDs= ", iDs);
                                    // console.log("ReductionState before= ", Object.assign(reductionState));
                                    // Add the first id returned to the list of reduced ids
                                    reductionState.iDsOfReducedNodes.push([
                                        iDs[0],
                                    ]);
                                    // Add the rest of the returned ids to the list of ids tht will have to be reduced in the next reduction step
                                    // console.log("iDs before shift", iDs);
                                    iDs.shift();
                                    // console.log("iDs after shift", iDs);
                                    // console.log("reductionState.iDsOfNodesToReduceNext before concat", reductionState.iDsOfNodesToReduceNext);
                                    reductionState.iDsOfNodesToReduceNext = reductionState.iDsOfNodesToReduceNext.concat(
                                        iDs,
                                    );
                                    // console.log("reductionState.iDsOfNodesToReduceNext after concat", reductionState.iDsOfNodesToReduceNext);
                                    // console.log("reductionState after= ", reductionState);
                                    resolve(reductionState);
                                }, logErrorFunction);
                        }, logErrorFunction);
                    }
                }, logErrorFunction);
            });
            return newPromise;
        }
        function reductionStep(
            reductionState,
            iDsToBeReduced,
            nbOfReductionStepsRemaining,
        ) {
            // console.log("REDUCTIONSTEP");
            // console.log("reductionState= ", reductionState);
            // console.log("iDsToBeReduced= ", iDsToBeReduced);
            // console.log("nbOfReductionStepsRemaining= "+nbOfReductionStepsRemaining);
            var promise = new Promise((resolve, reject) => {
                if (nbOfReductionStepsRemaining > 0) {
                    var reductionStatePromise = new Promise(
                        (resolve, reject) => {
                            resolve(reductionState);
                        },
                    );
                    iDsToBeReduced
                        .reduce(reductionFold, reductionStatePromise)
                        .then((finalReductionState) => {
                            var newIDsToBeReduced =
                                finalReductionState.iDsOfNodesToReduceNext;
                            var newReductionState = {
                                iDsOfReducedNodes:
                                    finalReductionState.iDsOfReducedNodes,
                                iDsOfNodesToReduceNext: [],
                            };
                            reductionStep(
                                newReductionState,
                                newIDsToBeReduced,
                                nbOfReductionStepsRemaining - 1,
                            ).then((result) => {
                                resolve();
                            }, logErrorFunction);
                        }, logErrorFunction);
                } else {
                    resolve();
                }
            });
            return promise;
        }
        window
            .reduceTermOneStepAndUpdateDatabase(node.propertyMap.term)
            .then((iDs) => {
                // console.log("iDs= ", iDs);
                var initialReductionState = {
                    iDsOfReducedNodes: [iDs[0]],
                    iDsOfNodesToReduceNext: [],
                };
                // console.log("initialReductionStateBefore= ", initialReductionState);
                iDs.shift();
                // console.log("initialReductionState= ", initialReductionState);
                reductionStep(
                    initialReductionState,
                    iDs,
                    numberOfReductionSteps - 1,
                ).then((result) => {
                    resolve();
                }, logErrorFunction);
            }, logErrorFunction);
    });
    return promise;
};

// ##### Contextual Menu (End)
// #############################

// #############################
// ##### Communication with Racket server (Start)

// Each message sent to the Racket server has an ID, and the server is expected to return the ID of the original message in the answer.
var redexMessageId = 0;
function getFreshRedexMessageId() {
    var result = redexMessageId;
    redexMessageId = redexMessageId + 1;
    return result;
}
// Contains a resolver function for each promise that was generated when a message was sent to the racket server. Key = id of the message sent to racket.
var redexMessagePromisesResolvers = [];
var racketServerSocket = null;

function setUpConnectionWithRacketServer(port) {
    address = "ws://localhost:" + port + "/";
    racketServerSocket = new WebSocket(address);
    racketServerSocket.onopen = function() {
        console.log("socket to racket server opened", arguments);
    };
    racketServerSocket.onclose = function() {
        console.log("socket to racket server closed", arguments);
    };
    racketServerSocket.onmessage = function(e) {
        // console.log("Received from redex: "+e);
        var obj = JSON.parse(e.data);
        if (verboseRacketServerInteraction) {
            console.log("Received from redex (parsed):");
            console.log(obj);
        }
        var messageId = parseInt(obj.messageId);
        // Calls the resolver of the promise for the receiver message
        redexMessagePromisesResolvers[messageId](obj);
    };
}

// Input: a string (message) to send to the racket server
// Prefixes the message with a message ID (separated from the message with ##### as a separator), creates a promise on which the caller can wait to get the answer of the racket server and returns it. Sends the message with its ID to the racket server.
function socketSendReturnPromise(message) {
    var messageId = getFreshRedexMessageId();
    var messageWithId = messageId + "#####" + message;
    if (verboseRacketServerInteraction) {
        console.log("Sending to redex:");
        console.log(messageWithId);
    }
    var promise = new Promise((resolve, reject) => {
        // Stores a resolver for this promise
        redexMessagePromisesResolvers[messageId] = (result) => resolve(result);
        racketServerSocket.send(messageWithId);
    });
    return promise;
}

// ##### Communication with Racket server (End)
// #############################

// #############################
// ##### Neo4j interaction (Start)

// Contains the neo4j session, used to run cypher statements on the database
var neo4jSession = null;

function connectToNeo4jDatabase() {
    var authToken = neo4j.v1.auth.basic("neo4j", "neo4j-js-password");
    console.log(authToken);
    var driver = neo4j.v1.driver("bolt://localhost", authToken, {
        encrypted: false,
    });
    neo4jSession = driver.session();
}

// Converts non-string values to strings, and surrounds string values with quotation marks
function valueToStringForUseInCypherStatement(value) {
    if (typeof value === "string") {
        return '"' + value + '"';
    } else {
        return "" + value;
    }
}

// Asynchronous: returns a promise
// Takes a term, sends it to the racket server, gets back a term object for it (object containing the term and additional attributes) and a term object for each of its one-step reductions
// Create nodes in the database for each of these term objects, with attributes the attributes present in the term objects, and adds the reduction relation between these nodes.
// Returns a promise that will resolve to an array containing the ids of the nodes corresponding to 1) the original term and 2) all the terms that were sent by the racket server.
window.reduceTermOneStepAndUpdateDatabase = function(term) {
    // console.log("reduceTermOneStepAndUpdateDatabase:");
    // console.log(term);
    var promise = new Promise((resolve, reject) => {
        socketSendReturnPromise(term).then((racketAnswer) => {
            console.log("racketAnswer= ", racketAnswer);
            const fromTermObject = racketAnswer.from.term_object;
            getOrCreateNodeForTermObject(fromTermObject).then((fromNodeID) => {
                var reductionDetails = racketAnswer.next;
                function processReductionDetail(reductionDetail) {
                    var intermediatePromise = new Promise((resolve, reject) => {
                        const termObject = reductionDetail.term_object;
                        const reductionRuleName = reductionDetail.rule;
                        getOrCreateNodeForTermObject(termObject).then(
                            (reductionNodeID) => {
                                setNodeRelationIfNotAlreadyThere(
                                    fromNodeID,
                                    reductionNodeID,
                                    "REDUCESTO",
                                    "rule",
                                    reductionRuleName,
                                ).then((result) => {
                                    resolve(reductionNodeID);
                                }, logErrorAndRejectPromiseFunctionFactory(reject));
                            },
                            logErrorAndRejectPromiseFunctionFactory(reject),
                        );
                    });
                    return intermediatePromise;
                }
                var iDsOfReductionNodes_promises = reductionDetails.map(
                    processReductionDetail,
                );
                Promise.all(iDsOfReductionNodes_promises).then(
                    (iDsOfReductionNode) => {
                        resolve([fromNodeID].concat(iDsOfReductionNode));
                    },
                    logErrorAndRejectPromiseFunctionFactory(reject),
                );
            }, logErrorAndRejectPromiseFunctionFactory(reject));
        }, logErrorAndRejectPromiseFunctionFactory(reject));
    });
    return promise;
};

// Clears the database of all of its nodes
window.emptyDatabase = function() {
    neo4jSession.run("MATCH (n) OPTIONAL MATCH (n)-[r]-() DELETE n,r");
    console.log("Neo4j Database emptied");
};

// Asynchronous: returns a promise
// Calls checkNodeRelation to check whether the relation already exists. If it does not, calls setNodeRelation to create it.
// More information about the arguments and behaviour in the comments of the two aforementioned functions
function setNodeRelationIfNotAlreadyThere(
    sourceNodeID,
    targetNodeID,
    relationName,
    relationAttributeNameOrNull,
    relationAttributeValueOrNull,
) {
    var promise = new Promise((resolve, reject) => {
        checkNodeRelation(
            sourceNodeID,
            targetNodeID,
            relationName,
            relationAttributeNameOrNull,
            relationAttributeValueOrNull,
        ).then((relationExists) => {
            if (!relationExists) {
                resolve(
                    setNodeRelation(
                        sourceNodeID,
                        targetNodeID,
                        relationName,
                        relationAttributeNameOrNull,
                        relationAttributeValueOrNull,
                    ),
                );
            } else {
                resolve();
            }
        }, logErrorAndRejectPromiseFunctionFactory(reject));
    });
    return promise;
}

// Asynchronous: returns a promise
// Returns whether there is a relation named relationName from the node of ID sourceNodeID to the node of ID targetNodeID in the graph database
// Additionally, if relationAttributeNameOrNull is not null, require the relation to have an attribute named relationAttributeNameOrNull and worth relationAttributeValueOrNull
// Note: relationName is converted to uppercase to match cypher's style
// Note: relationAttributeNameOrNull is converted to lowercase to match cypher's style
// Note: Only supports one relation attribute for the moment. Could be improved to deal with an arbitrary number of relation attributes
// Example of cypher statement ran by this function: MATCH (e)-[:REDUCESTO {rule:"set"}]->(f) WHERE ID(e)=2 AND ID(f)=5 RETURN ID(e)
function checkNodeRelation(
    sourceNodeID,
    targetNodeID,
    relationName,
    relationAttributeNameOrNull,
    relationAttributeValueOrNull,
) {
    var promise = new Promise((resolve, reject) => {
        var relationNameUppercase = relationName.toUpperCase();
        var cypherStatement = "MATCH (e)-[:" + relationNameUppercase;
        if (relationAttributeNameOrNull != null) {
            var relationAttributeNameLowerCase = relationAttributeNameOrNull.toLowerCase();
            cypherStatement =
                cypherStatement +
                " {" +
                relationAttributeNameLowerCase +
                ":" +
                valueToStringForUseInCypherStatement(
                    relationAttributeValueOrNull,
                ) +
                "}";
        }
        cypherStatement =
            cypherStatement +
            "]->(f) WHERE ID(e)=" +
            sourceNodeID +
            " AND ID(f)= " +
            targetNodeID +
            " RETURN ID(e)";
        neo4jSession.run(cypherStatement).then((result) => {
            resolve(result.records.length >= 1);
        }, cypherErrorPrintAndRejectPromiseFunctionFactory(reject));
    });
    return promise;
}

// Asynchronous: returns a promise
// Adds a relation named relationName from node with ID sourceNodeID to node with ID targetNodeID in the graph database
// Additionally, if relationAttributeNameOrNull is not null, add an attribute to the relation named relationAttributeNameOrNull and worth relationAttributeValueOrNull
// Note: relationName is converted to uppercase to match cypher's style
// Note: relationAttributeNameOrNull is converted to lowercase to match cypher's style
// Note: Only supports one relation attribute for the moment. Could be improved to deal with an arbitrary number of relation attributes
// Example of cypher statement ran by this function: MATCH (e) WHERE ID(e)=2 MATCH (f) WHERE ID(f)=5 CREATE (e)-[:REDUCESTO {rule:"set"}]->(f)
function setNodeRelation(
    sourceNodeID,
    targetNodeID,
    relationName,
    relationAttributeNameOrNull,
    relationAttributeValueOrNull,
) {
    var promise = new Promise((resolve, reject) => {
        var relationNameUppercase = relationName.toUpperCase();
        var cypherStatement =
            "MATCH (e) WHERE ID(e)=" +
            sourceNodeID +
            " MATCH (f) WHERE ID(f)=" +
            targetNodeID +
            " CREATE (e)-[:" +
            relationNameUppercase;
        if (relationAttributeNameOrNull != null) {
            var relationAttributeNameLowerCase = relationAttributeNameOrNull.toLowerCase();
            cypherStatement =
                cypherStatement +
                " {" +
                relationAttributeNameLowerCase +
                ":" +
                valueToStringForUseInCypherStatement(
                    relationAttributeValueOrNull,
                ) +
                "}";
        }
        cypherStatement = cypherStatement + "]->(f)";
        neo4jSession.run(cypherStatement).then((result) => {
            resolve(null);
        }, cypherErrorPrintAndRejectPromiseFunctionFactory(reject));
    });
    return promise;
}

// Asynchronous: returns a promise
// Input: the IDs of two nodes
// Returns whether the first node is related to the second via the "REDUCESTO" relation
window.doesSourceNodeReducesToTargetNode = function(
    sourceNodeID,
    targetNodeID,
) {
    var cypherStatement =
        "MATCH (e)-[:REDUCESTO]->(f) WHERE ID(e)=" +
        sourceNodeID +
        " AND ID(f)=" +
        targetNodeID +
        " RETURN ID(e)";
    var promise = new Promise((resolve, reject) => {
        neo4jSession.run(cypherStatement).then((result) => {
            resolve(result.records.length >= 1);
        }, cypherErrorPrintAndRejectPromiseFunctionFactory(reject));
    });
    return promise;
};

// Asynchronous: returns a promise
// Input: the IDs of two nodes
// Adds the "REDUCESTO" relation from the first node to the second in the database
window.setReducesToRelationFromSourceNodeToTargetNode = function(
    sourceNodeID,
    targetNodeID,
) {
    var promise = new Promise((resolve, reject) => {
        var cypherStatement =
            "MATCH (e) WHERE ID(e)=" +
            sourceNodeID +
            " MATCH (f) WHERE ID(f)=" +
            targetNodeID +
            " CREATE (e)-[:REDUCESTO]->(f)";
        neo4jSession.run(cypherStatement).then((result) => {
            resolve(null);
        }, cypherErrorPrintAndRejectPromiseFunctionFactory(reject));
    });
    return promise;
};

// Asynchronous: returns a promise.
// Given a termObject, checks whether a node with the same term exists in the database.
// If there is one, this function returns its ID.
// If there is none, it creates one, and returns the ID of the newly created node.
window.getOrCreateNodeForTermObject = function(termObject) {
    // console.log("getOrCreateNodeForTermObject. termObject=");
    // console.log(termObject);
    var term = termObject.term;
    var promise = new Promise((resolve, reject) => {
        isTermAlreadyInTheDatabase(term).then((falseOrID) => {
            if (falseOrID == false) {
                // No node exist already for this termObject. Creating one.
                addTermObjectToDatabase(termObject).then((id) => {
                    resolve(id);
                }, logErrorAndRejectPromiseFunctionFactory(reject));
            } else {
                // A node exists for this termObject.
                resolve(falseOrID);
            }
        }, logErrorAndRejectPromiseFunctionFactory(reject));
    });
    return promise;
};

// Asynchronous: returns a promise.
// Returns false if a node with the same term as the argument is in the database
// Otherwise, returns the id of a node that has the same term as the argument.
window.isTermAlreadyInTheDatabase = function(term) {
    var statement = 'MATCH (e) WHERE e.term = "' + term + '" RETURN ID(e)';
    var promise = new Promise((resolve, reject) => {
        neo4jSession.run(statement).then((result) => {
            var records = result.records;
            var summary = result.summary;
            if (records.length >= 1) {
                // Found a node with the same term as the argument
                var id = records[0]._fields[0].low;
                resolve(id);
            } else {
                // No node found with the same term as the argument
                resolve(false);
            }
        }, cypherErrorPrintAndRejectPromiseFunctionFactory(reject));
    });
    return promise;
};

// Asynchronous: returns a promise.
// Given a termObject, creates a node for it in the database and returns the created node's ID.
window.addTermObjectToDatabase = function(termObject) {
    var promise = new Promise((resolve, reject) => {
        var term = termObject[term];
        var cypherStatement = "CREATE (e:Term {";
        cypherStatementEnd = "}) RETURN ID(e)";
        // Adds to the cypher statement the attributes of the node. Add a comma before each attribute declaration but the first.
        var addComma = false;
        for (k in termObject) {
            if (addComma) {
                cypherStatement = cypherStatement + ", ";
            } else {
                addComma = true;
            }
            cypherStatement =
                cypherStatement +
                k +
                ": " +
                valueToStringForUseInCypherStatement(termObject[k]);
        }
        cypherStatement = cypherStatement + cypherStatementEnd;
        neo4jSession.run(cypherStatement).then((result) => {
            var records = result.records;
            var nodeID = records[0]._fields[0].low;
            resolve(nodeID);
        }, cypherErrorPrintAndRejectPromiseFunctionFactory(reject));
    });
    return promise;
};

// Queries the neo4j database and refreshes the graph visualisation on the webpage
window.refreshGraph = function() {
    console.log("refresh graph");
    var graphId, tableId, sourceId, execId, urlSource, renderGraph, query;
    graphId = "graph";
    tableId = "datatable";
    sourceId = "cypher";
    execId = "execute";
    urlSource = function() {
        return {
            url: $("#neo4jUrl").val(),
            user: $("#neo4jUser").val(),
            pass: $("#neo4jPass").val(),
        };
    };
    renderGraph = true;
    var cbResult = null;
    query = " MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 50;";
    var neod3 = new Neod3Renderer();
    var neo = new Neo(urlSource);
    try {
        console.log("Executing Query", query);
        var execButton = $(this).find("i");
        execButton.toggleClass("fa-play-circle-o fa-spinner fa-spin");
        neo.executeQuery(query, {}, function(err, res) {
            execButton.toggleClass("fa-spinner fa-spin fa-play-circle-o");
            res = res || {};
            var graph = res.graph;
            if (renderGraph) {
                if (graph) {
                    var c = $("#" + graphId);
                    c.empty();
                    neod3.render(graphId, c, graph);
                    renderResult(tableId, res.table);
                } else {
                    if (err) {
                        console.log(err);
                        if (err.length > 0) {
                            sweetAlert(
                                "Cypher error",
                                err[0].code + "\n" + err[0].message,
                                "error",
                            );
                        } else {
                            sweetAlert(
                                "Ajax " + err.statusText,
                                "Status " + err.status + ": " + err.state(),
                                "error",
                            );
                        }
                    }
                }
            }
            if (cbResult) cbResult(res);
        });
    } catch (e) {
        console.log(e);
        sweetAlert("Catched error", e, "error");
    }
    return false;
};

// Asynchronous: returns a promise.
// Takes the ID of a node in the graph database and an attribute name, and returns a promise that will resolve to the value of the specified attribute for the node with the specified ID
// Example of cypher statement ran by this function: MATCH (e) WHERE ID(e)=5 RETURN e.term
function getAttributeOfNode(nodeID, attributeName) {
    var cypherStatement =
        "MATCH (e) WHERE ID(e)=" + nodeID + " RETURN e." + attributeName;
    var promise = new Promise((resolve, reject) => {
        neo4jSession.run(cypherStatement).then((result) => {
            resolve(result.records[0]._fields[0]);
        }, cypherErrorPrintAndRejectPromiseFunctionFactory(reject));
    });
    return promise;
}

// ##### Neo4j interaction (End)
// #############################
