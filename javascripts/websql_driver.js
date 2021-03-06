window.WebSQL_driver = function () {
	
	var db = null;
	
	var nativeSQLite = (window.openDatabase !== undefined);

	var splitStatement = function (statements)
	{	
		return statements ? statements.split(/;\s*\r?\n|$/) : []; 
	}

	this.buildSchema = function (args) {
		try {
		
			if (nativeSQLite)
			{
				db = openDatabase(args["short_code"], '1.0', args["short_code"], args["ddl"].length * 1024);

				db.transaction(function(tx){
					$.each(splitStatement(args["ddl"]), function (i, statement) {
							tx.executeSql(statement);
					});
				});
				
				args["success"]();
			}
			else
			{
				args["error"]("SQLite (WebSQL) not available in your browser. Try either using a webkit-based browser (such as Safari or Chrome) or using the SQLite (SQL.js) database type.")
			}

		}
		catch (e)
		{
			args["error"](e);
		}

	}
	
	
	this.executeQuery = function (args) {
		
		try {
			
			if (!db) {
				throw ("Database Schema not available!");
			}
			
			var returnSets = [];
			
			db.transaction(function(tx){


				var sequentiallyExecute = function(tx2, result) {
							
					var thisSet = {
						"SUCCEEDED": true,
						"EXECUTIONTIME": (new Date()) - startTime,
						"RESULTS": {
							"COLUMNS": [],
							"DATA": []
						},
						"EXECUTIONPLAN": {
							"COLUMNS": [],
							"DATA": []
						}
					
					};
					
					for (var i = 0; i < result.rows.length; i++) {
						var rowVals = [];
						var item = result.rows.item(i);
						
						/* We can't be sure about the order of the columns returned, since they are returned as
						 * a simple unordered structure. So, we'll just take the order returned the from the first
						 * request, then just use that order for each row.
						 */
						if (i == 0) {
							for (col in item) {
								thisSet["RESULTS"]["COLUMNS"].push(col);
							}
						}
						
						for (var j = 0; j < thisSet["RESULTS"]["COLUMNS"].length; j++) {
							rowVals.push(item[thisSet["RESULTS"]["COLUMNS"][j]]);
						}
						
						thisSet["RESULTS"]["DATA"].push(rowVals);
					}
					
					tx.executeSql("EXPLAIN QUERY PLAN " + statement, [], function (tx3, executionPlanResult) {

						for (var l = 0; l < executionPlanResult.rows.length; l++) {
							var rowVals = [];
							var item = executionPlanResult.rows.item(l);
							
							/* We can't be sure about the order of the columns returned, since they are returned as
							 * a simple unordered structure. So, we'll just take the order returned the from the first
							 * request, then just use that order for each row.
							 */
							if (l == 0) {
								for (col in item) {
									thisSet["EXECUTIONPLAN"]["COLUMNS"].push(col);
								}
							}
							
							for (var j = 0; j < thisSet["EXECUTIONPLAN"]["COLUMNS"].length; j++) {
								rowVals.push(item[thisSet["EXECUTIONPLAN"]["COLUMNS"][j]]);
							}
							
							thisSet["EXECUTIONPLAN"]["DATA"].push(rowVals);
						}
					
						returnSets.push(thisSet);						
						
						// executeSQL runs asynchronously, so we have to make recursive calls to handle subsequent queries in order.
						if (currentStatement < (statements.length - 1)) 
						{
							currentStatement++;						
							statement = statements[currentStatement];
							
							tx.executeSql(statement, [], sequentiallyExecute, handleFailure);
						}
						else
						{
							tx.executeSql("intentional failure used to rollback transaction");
							args["success"](returnSets);
						}

						
					}
					);
					
				}
				
				var handleFailure = function (tx, result) {
					
					var thisSet = {
						"SUCCEEDED": false,
						"EXECUTIONTIME": (new Date()) - startTime,
						"ERRORMESSAGE": result.message
					};
					returnSets.push(thisSet);
					args["success"](returnSets); // 'success' - slightly confusing here, but in this context a failed query is still a valid result from the database 
				}
				
				var setArray = [], k, stop = false;
				var statements = splitStatement(args["sql"]);
				var currentStatement = 0;
				var statement = statements[currentStatement];
				
				var startTime = new Date();
				
				/*
				 * executeSql runs asynchronously, so I impose a semblance of synchronous-ness via recusive calls
				 */
				tx.executeSql(statement, [], sequentiallyExecute, handleFailure);
				


			});
			
		}
		catch (e)
		{
			args["error"](e);
		}
		
		
	}
	
	return this;
	
}
