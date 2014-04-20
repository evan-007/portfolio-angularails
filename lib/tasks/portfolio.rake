task import_projects: :environment do
	require 'csv'
	@title = 0
	@lede = 1
	@desc = 2
	@git = 3

	CSV.foreach("#{Rails.root}/lib/tasks/portfolio-sites.csv") do |row|
		p = Project.new(title: row[@title],
			lede: row[@lede],
			description: row[@desc],
			git: row[@git])

		p.save
	end
end