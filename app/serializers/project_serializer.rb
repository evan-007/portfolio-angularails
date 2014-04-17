class ProjectSerializer < ActiveModel::Serializer
	attributes :title, :description, :tag_list, :id
end