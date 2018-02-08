mcda-elicitation-web
====================

This tool provides a web interface for Multiple Criteria Decision
Analysis preference elicitation. Currently, it supports eliciting the
following types of preference information:

 - Linear partial value functions
 - Piece-wise linear partial value functions using MACBETH
 - Ordinal criteria trade-offs (ordinal SWING)
 - Exact criteria trade-off ratios (exact SWING)
 - Imprecise criteria trade-off ratios (interval SWING)

The tool uses the [Patavi][patavi] web service wrapper for R and the
'hitandrun' and 'smaa' R packages to calculate MCDA results during and
after the preference elicitation process.

mcda-elicitation-web is a component of the [drugis.org][drugis] ADDIS 2
project. For more information on all components of the drugis project, please refer to the OVERALL-README.md in the root folder of the ADDIS-CORE project.

Initialize submodules
---------------------

```
git submodule init
git submodule update
```

Compiling the CSS
-----------------

Using compass (through `config.rb`):

```
compass compile
```

Using node-sass:

```
node-sass --include-path sass-shared sass/mcda-plain.scss app/css/mcda-plain.css
node-sass --include-path sass-shared sass/mcda-drugis.scss app/css/mcda-drugis.css
node-sass --include-path sass-shared sass/mcda-drugis-ie8.scss app/css/mcda-drugis-ie8.css
```

Setting up the database
-----------------------

`sudo -u postgres psql -c "CREATE USER mcdaweb WITH PASSWORD 'develop'"`
`sudo -u postgres psql -c "CREATE DATABASE mcdaweb ENCODING 'utf-8' OWNER mcdaweb"`
`psql -d mcdaweb -U mcdaweb -f database.pg.sql`

Running
----------

Set environment variables:

```
export MCDAWEB_DB_USER=mcdaweb
export MCDAWEB_DB_PASSWORD=develop
export MCDAWEB_DB_HOST=localhost
export MCDAWEB_DB_NAME=mcdaweb
export MCDAWEB_GOOGLE_KEY=<something>
export MCDAWEB_GOOGLE_SECRET=<something-else>
export MCDA_HOST=localhost
export PATAVI_HOST=localhost
export PATAVI_PORT=3000
export PATAVI_CLIENT_KEY=path/to/key
export PATAVI_CLIENT_CRT=/path/to/crt
export PATAVI_CA=/path/to/ca
```

```yarn```

```node index.js```

Running the patavi worker
-------------------------

As a prerequisite, build the patavi worker image from the patavi repository.

Then, build the worker itself, in the `R` directory:

    docker build --tag patavi/worker-smaa_v2 .

Run the worker:

    docker run -d --link <rabbitmq-container-name>:rabbit --name patavi-smaa_v2 patavi/worker-smaa_v2


License
-------

mcda-elicitation-web is open source, and licensed under [GPLv3][gpl-3].
See [LICENSE.txt](LICENSE.txt) for more information.

[patavi]: https://github.com/joelkuiper/patavi
[gpl-3]: http://gplv3.fsf.org/
[drugis]: http://drugis.org/
