## Installation Instructions
- Get neo4j desktop. https://neo4j.com/download/
- Clone our github repository (it's a private repository). https://github.com/chscholl/GraphRedex
- Run neo4j desktop, then:
	- Create a project
	- Create a graph(=database) with password "neo4j-js-password" (this password is hardcoded in client.js)
	- Start it
	- Click "Manage", then "Open Browser"
- `./installRequiredRacketPackages.sh`
	to install the required racket packages
- `racket Threads.rkt`
	to run the racket server
- Open web.html in your browser
	- Click "Send term"
- In the neo4j browser, run the query "MATCH (e) RETURN e" to show all the nodes in the graph. "MATCH (e) DELETE e" to remove them.
