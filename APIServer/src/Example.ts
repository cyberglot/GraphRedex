import { Graph } from "arangojs";
import {
    GraphEdgeCollection,
    GraphVertexCollection,
} from "arangojs/lib/cjs/graph";
import MyDatabase from "./Database";

export interface ExampleMeta {
    lang: any;
    name: string;
    _key: string;
    _id: string;
    baseTerm: string;
    baseTermString: string;
}

export default class Example {
    private name: string;
    private graph: Graph;
    private baseTerm: string;
    private vertexCollection: GraphVertexCollection;
    private edgeCollection: GraphEdgeCollection;
    private db: MyDatabase;
    private meta: ExampleMeta;

    /**
     *
     * @param database A database connection
     * @param meta     The metadata of an example
     */
    constructor(database: MyDatabase, meta: ExampleMeta) {
        this.meta = meta;
        this.baseTerm = meta.baseTerm;
        this.db = database;
        this.name = this.baseTerm.split("/")[0];
        this.graph = database.ro.graph(this.name);
        this.baseTerm = this.baseTerm;
        this.vertexCollection = this.graph.vertexCollection(this.graph.name);
        this.edgeCollection = this.graph.edgeCollection(
            this.graph.name + "-reductions",
        );
    }

    async getLanguage(): Promise<Language> {
        return (
            await this.db.languages(false).lookupByKeys([this.meta.lang])
        )[0];
    }

    delete(): any {
        this.db.examples(true).removeByKeys([this.meta._key], {});
        this.db.rw
            .collection("users-examples")
            .removeByExample({ _to: this.meta._key });
        // do not drop graph, it may contain data for other examples
    }

    /**
     * Execute a query on the graph database
     * Binding
     *  - @@nodes to the collection of nodes
     *  - @@edges to the collection of edges
     *  - @start  to the id of the start node
     *  - @graph  to the graph of the start node
     *
     * @param qry
     */
    public async qry(qry: string, focus: string | null): Promise<any[]> {
        const binds = {};
        const availibleBind = {
            "@nodes": this.vertexCollection.name,
            "@edges": this.edgeCollection.name,
            "graph": this.graph.name,
            "start": this.baseTerm,
            "focus": focus,
        };

        const usedBinds = (await this.db.parse(qry)).bindVars;
        for (const bind of usedBinds) {
            if (availibleBind[bind] ?? null !== null) {
                binds[bind] = availibleBind[bind];
            } else {
                throw `Bind @${bind} not availible!`;
            }
        }

        return await this.db.ro
            .query(qry, binds)
            .then((cursor) => cursor.all())
            .then((keys) => Object.assign(keys));
    }
}
