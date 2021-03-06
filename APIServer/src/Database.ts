/// <reference path="../node_modules/arangojs/lib/cjs/database.d.ts">
import arangojs, { Database, DocumentCollection, Graph } from "arangojs";
import { ParseResult } from "arangojs/lib/cjs/database";
import { User } from "./Users";

export default class MyDatabase {
    private constructor(rwConnection: Database, roConnection: Database) {
        this.dbRO = roConnection;
        this.dbRW = rwConnection;
    }

    public static async bootstrap(): Promise<MyDatabase> {
        const dbRO = arangojs({});
        await dbRO.login("graphredex-qry", "graphredex-qry"); // read only access
        dbRO.useDatabase("graphredex-data");
        dbRO.useBasicAuth("graphredex-qry", "graphredex-qry");

        const dbRW = arangojs({});
        await dbRW.login("graphredex", "graphredex"); // rw access
        dbRW.useDatabase("graphredex-data");
        dbRW.useBasicAuth("graphredex", "graphredex");
        return new MyDatabase(dbRW, dbRO);
    }

    private readonly dbRO: Database;
    private readonly dbRW: Database;

    get ro() {
        return this.dbRO;
    }

    get rw() {
        return this.dbRW;
    }

    public parse(query: string): Promise<ParseResult> {
        return this.ro.parse(query);
    }

    public users(write: boolean = false): DocumentCollection {
        return this.connection(write).collection("users");
    }

    public examples(write: boolean = false): DocumentCollection {
        return this.connection(write).collection("examples");
    }

    public languages(write: boolean = false): DocumentCollection {
        return this.connection(write).collection("languages");
    }

    private connection(write: boolean) {
        return write ? this.dbRW : this.dbRO;
    }

    public async reductionGraph(
        user: User,
        lang: Language,
        createIfNotExisit: boolean = false,
    ): Promise<Graph> {
        const name = `results-${user._key}-${lang._key}`;
        const graph = this.dbRW.graph(name);
        const nodeCollecion = this.dbRW.collection(name);
        const edgeCollection = this.dbRW.edgeCollection(name + "-reductions");

        if (!(await nodeCollecion.exists())) {
            if (!createIfNotExisit) {
                throw `Reduction graph ${name} does not exist`;
            }
            await nodeCollecion.create();
            await nodeCollecion.createIndex({
                type: "hash",
                fields: ["term"],
            });
        }

        if (!(await graph.exists())) {
            if (!createIfNotExisit) {
                throw `Reduction graph ${name} does not exist`;
            }
            await graph.create({
                edgeDefinitions: [
                    {
                        collection: edgeCollection.name,
                        from: [nodeCollecion.name],
                        to: [nodeCollecion.name],
                    },
                ],
            });
        }

        return graph;
    }
}
